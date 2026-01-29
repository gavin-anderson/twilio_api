// services/storeInboundMessage.ts
import { pool } from "../db/pool";

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

        // 1) Conversation
        const convoRes = await client.query<{ id: string }>(
            `
      INSERT INTO conversations (channel, user_number)
      VALUES ('whatsapp', $1)
      ON CONFLICT (channel, user_number)
      DO UPDATE SET updated_at = now()
      RETURNING id
      `,
            [params.fromAddress]
        );

        const conversationId = convoRes.rows[0].id;

        // 2) Inbound message (idempotent)
        const inboundRes = await client.query<{ id: string }>(
            `
      INSERT INTO inbound_messages (
        conversation_id,
        provider,
        provider_message_sid,
        from_address,
        to_address,
        body,
        raw_payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (provider, provider_message_sid)
      DO NOTHING
      RETURNING id
      `,
            [
                conversationId,
                params.provider,
                params.providerMessageSid,
                params.fromAddress,
                params.toAddress,
                params.body,
                params.rawPayload,
            ]
        );

        // If duplicate webhook, inbound already exists
        if (inboundRes.rowCount === 0) {
            await client.query("COMMIT");
            return;
        }

        const inboundId = inboundRes.rows[0].id;

        // 3) Reply job (idempotent)
        await client.query(
            `
      INSERT INTO reply_jobs (conversation_id, inbound_message_id, status)
      VALUES ($1,$2,'queued')
      ON CONFLICT (inbound_message_id) DO NOTHING
      `,
            [conversationId, inboundId]
        );

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}
