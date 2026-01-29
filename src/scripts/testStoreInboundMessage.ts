import "dotenv/config";
import crypto from "crypto";
import fetch from "node-fetch";
import { Pool } from "pg";

function requiredEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}

async function main() {
    const apiBase = requiredEnv("API_BASE_URL").replace(/\/$/, "");
    const dbUrl = requiredEnv("DATABASE_URL");

    const from = process.env.TEST_FROM ?? "whatsapp:+6137840122";
    const to = process.env.TEST_TO ?? "whatsapp:+19999990000";

    // Use a unique Twilio MessageSid each run to avoid conflict
    const messageSid = `SM_TEST_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const body = `hello from test script ${new Date().toISOString()}`;

    // Twilio webhook body is x-www-form-urlencoded
    const params = new URLSearchParams();
    params.set("From", from);
    params.set("To", to);
    params.set("Body", body);
    params.set("MessageSid", messageSid);

    const url = `${apiBase}/message`;

    console.log("POST", url);
    console.log("From:", from);
    console.log("To:", to);
    console.log("MessageSid:", messageSid);
    console.log("Body:", body);

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });

    const text = await res.text();
    console.log("\n--- HTTP Response ---");
    console.log("Status:", res.status);
    console.log("Body:", text || "<empty>");

    if (res.status !== 200) {
        process.exitCode = 1;
        return;
    }

    // Verify DB writes
    const pool = new Pool({
        connectionString: dbUrl,
        // If you needed the Supabase pooler SSL workaround:
        ssl: process.env.PG_SSL_REJECT_UNAUTHORIZED === "false" ? { rejectUnauthorized: false } : undefined,
    });

    try {
        // 1) inbound inserted?
        const inbound = await pool.query(
            `
      SELECT id, conversation_id, provider, provider_message_sid, from_address, to_address, body, created_at
      FROM inbound_messages
      WHERE provider='twilio' AND provider_message_sid=$1
      `,
            [messageSid]
        );

        if (inbound.rowCount === 0) {
            console.error("\n❌ inbound_messages row not found");
            process.exitCode = 1;
            return;
        }

        const inboundRow = inbound.rows[0];
        console.log("\n✅ inbound_messages row found:");
        console.log(inboundRow);

        // 2) conversation exists?
        const convo = await pool.query(
            `
      SELECT id, channel, user_number, created_at, updated_at
      FROM conversations
      WHERE id=$1
      `,
            [inboundRow.conversation_id]
        );

        console.log("\n✅ conversations row:");
        console.log(convo.rows[0]);

        // 3) reply_job enqueued?
        const job = await pool.query(
            `
      SELECT id, status, attempts, max_attempts, run_after, created_at
      FROM reply_jobs
      WHERE inbound_message_id=$1
      `,
            [inboundRow.id]
        );

        if (job.rowCount === 0) {
            console.error("\n❌ reply_jobs row not found");
            process.exitCode = 1;
            return;
        }

        console.log("\n✅ reply_jobs row:");
        console.log(job.rows[0]);

        console.log("\n🎉 Inbound storage test passed.");
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
