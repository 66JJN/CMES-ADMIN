import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    value: mongoose.Schema.Types.Mixed,
    description: String,
    type: {
      type: String,
      enum: ["string", "number", "boolean", "json"],
      default: "string",
    },
  },
  { timestamps: true }
);

const Setting = mongoose.model("Setting", settingSchema);

export default Setting;
