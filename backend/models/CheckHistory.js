import mongoose from "mongoose";

const checkHistorySchema = new mongoose.Schema(
  {
    giftId: {
      type: String,
      required: true,
    },
    giftName: String,
    senderName: {
      type: String,
      required: true,
    },
    tableNumber: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["verified", "pending", "rejected"],
      default: "verified",
    },
    type: {
      type: String,
      default: "text", // "text" or "image"
    },
    filePath: {
      type: String,
      default: null,
    },
    approvalDate: Date,
    approvedBy: String,
    notes: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const CheckHistory = mongoose.model("CheckHistory", checkHistorySchema);

export default CheckHistory;
