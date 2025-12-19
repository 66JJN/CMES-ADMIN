import mongoose from "mongoose";
import dotenv from "dotenv";
import TimeHistory from "./models/TimeHistory.js";

dotenv.config();

mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'cmes-admin'
}).then(async () => {
    console.log("Connected to MongoDB");

    const history = await TimeHistory.find({});
    console.log("TimeHistory Items:");
    history.forEach(h => {
        console.log(`ID: ${h.id}, Mode: ${h.mode}, Duration: ${h.duration}, Price: ${h.price}, Date: ${h.date}`);
    });

    // Specifically look for 'text' mode duplicates
    const textItems = history.filter(h => h.mode === 'text');
    console.log("\nText Mode Items:", textItems.length);
    textItems.forEach(h => {
        console.log(JSON.stringify(h, null, 2));
    });

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
