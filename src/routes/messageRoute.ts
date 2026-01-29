// routes/messageRoute.ts
import { Router } from "express";
import { validateTwilio } from "../middleware/validateTwilio.js";
import { storeInboundMessage } from "../services/storeInboundMessage.js";

const router = Router();

router.post(
    "/message",
    validateTwilio,
    async (req, res) => {
        try {
            const from = String(req.body.From ?? "");
            const to = String(req.body.To ?? "");
            const body = String(req.body.Body ?? "");
            const messageSid = String(req.body.MessageSid ?? "");

            if (!from || !body || !messageSid) {
                console.warn("Malformed Twilio payload", req.body);
                return res.status(200).send("ok"); // still ack Twilio
            }

            await storeInboundMessage({
                provider: "twilio",
                providerMessageSid: messageSid,
                fromAddress: from,
                toAddress: to,
                body,
                rawPayload: req.body,
            });

            // IMPORTANT: respond immediately
            res.status(200).send("ok");
        } catch (err) {
            console.error("Message route error:", err);

            // Still return 200 to avoid Twilio retries
            res.status(200).send("ok");
        }
    }
);

export default router;
