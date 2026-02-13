// services/storeInboundMessage.ts
import { pool } from "../db/pool.js";

type StoreInboundParams = {
    provider: "twilio";
    providerMessageSid: string;
    fromAddress: string;
    toAddress: string;
    body: string;
    rawPayload: any;
};

export async function storeInboundMessage(params: StoreInboundParams) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1) Conversation (upsert on user_number)
        const convoRes = await client.query<{ id: string; reply_delay: string | null }>(
            `
      INSERT INTO conversations (channel, user_number, last_message_at)
      VALUES ('whatsapp', $1, now())
      ON CONFLICT (user_number)
      DO UPDATE SET last_message_at = now()
      RETURNING id, reply_delay
      `,
            [params.fromAddress]
        );

        const conversationId = convoRes.rows[0].id;
        const replyDelay = Number(convoRes.rows[0].reply_delay) || 0;

        // 2) Inbound message (idempotent, with queue fields)
        //    run_after = now() + reply_delay seconds from conversation
        await client.query(
            `
      INSERT INTO inbound_messages (
        conversation_id,
        provider,
        provider_message_sid,
        from_address,
        to_address,
        body,
        raw_payload,
        status,
        run_after
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'queued', now() + ($8::int * interval '1 second'))
      ON CONFLICT (provider_message_sid)
      DO NOTHING
      `,
            [
                conversationId,
                params.provider,
                params.providerMessageSid,
                params.fromAddress,
                params.toAddress,
                params.body,
                params.rawPayload,
                replyDelay,
            ]
        );

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}
