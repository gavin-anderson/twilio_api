import express from 'express';
import twilio from "twilio";


const app = express()
const port = Number(process.env.PORT) || 3000;


app.use(express.urlencoded({ extended: false }));


app.post("/message", (req, res) => {

    // Needs middleware For validating twilio

    console.log(`From: ${JSON.stringify(req.body.FROM)}`);
    console.log(`Req: ${JSON.stringify(req.body.Body)}`);

    console.log(`General Body: ${JSON.stringify(req.body)}`);

    const twiml = new twilio.twiml.MessagingResponse();

    twiml.message("Hello Malcolm");

    res.type("text/xml");
    res.send(twiml.toString());

});

app.get("/health", (_req, res) => res.send("ok"));

app.listen(port, () => {
    console.log(`Server is running on port: ${port || ""}`)
})