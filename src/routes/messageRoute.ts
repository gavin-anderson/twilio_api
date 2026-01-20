import { Router } from "express";
import twilio from "twilio";
import { modelReplyService } from "../services/modelReplyService.js";
// import { validateTwilio } from "../middleware/validateTwilio.js";

const router = Router();

router.post("/message", async (req, res) => {
    const twiml = new twilio.twiml.MessagingResponse();

    try {
        const from = String(req.body.From ?? "");
        const body = String(req.body.Body ?? "");

        const reply = await modelReplyService(body, from);
        twiml.message(reply);
    } catch (err) {
        console.error("Message route error:", err);
        twiml.message("Something went wrong. Try again.");
    }

    res.type("text/xml").send(twiml.toString());
});

export default router;
