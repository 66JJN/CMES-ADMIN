import mongoose from "mongoose";

const timeHistorySchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    mode: {
        type: String, // 'text', 'image', 'birthday'
        required: true
    },
    date: String,     // e.g. "14/12/2025" or ISO string
    duration: String, // e.g. "1 ชั่วโมง"
    price: Number,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const TimeHistory = mongoose.model("TimeHistory", timeHistorySchema);

export default TimeHistory;
