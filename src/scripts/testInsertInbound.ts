import "dotenv/config";
import crypto from "crypto";
import { pool } from "../db/pool.js";
import { storeInboundMessage } from "../services/storeInboundMessage.js";

async function main() {
    const messageSid = `SM_TEST_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const from = "whatsapp:+6137940172";
    const to = "whatsapp:+19999990000";
    const body = `[DEV MESSAGE]: test-message`;

    console.log("Inserting inbound message...");
    console.log("MessageSid:", messageSid);
    console.log("Body:", body);

    await storeInboundMessage({
        provider: "twilio",
        providerMessageSid: messageSid,
        fromAddress: from,
        toAddress: to,
        body,
        rawPayload: { From: from, To: to, Body: body, MessageSid: messageSid },
    });

    // Verify the insert
    const inbound = await pool.query(
        `SELECT id, conversation_id, provider_message_sid, status, run_after, received_at
         FROM inbound_messages
         WHERE provider_message_sid = $1`,
        [messageSid]
    );

    if (inbound.rowCount === 0) {
        console.error("\n❌ inbound_messages row not found");
        process.exitCode = 1;
        return;
    }

    const row = inbound.rows[0];
    console.log("\n✅ inbound_messages row:");
    console.log(row);

    const convo = await pool.query(
        `SELECT id, user_number, reply_delay, last_message_at
         FROM conversations
         WHERE id = $1`,
        [row.conversation_id]
    );

    console.log("\n✅ conversations row:");
    console.log(convo.rows[0]);

    console.log("\n🎉 Insert test passed.");
    await pool.end();
}

main().catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exitCode = 1;
});
