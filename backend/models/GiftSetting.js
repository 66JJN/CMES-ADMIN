import mongoose from "mongoose";

const giftSettingSchema = new mongoose.Schema(
  {
    giftId: {
      type: String,
      unique: true,
      required: true,
    },
    giftName: {
      type: String,
      required: true,
    },
    description: String,
    price: {
      type: Number,
      required: true,
    },
    available: {
      type: Boolean,
      default: true,
    },
    stock: {
      type: Number,
      default: 0,
    },
    image: String,
    category: String,
    minDonationAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const GiftSetting = mongoose.model("GiftSetting", giftSettingSchema);

export default GiftSetting;
