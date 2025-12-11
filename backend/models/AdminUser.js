import mongoose from "mongoose";

const adminUserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["super_admin", "admin", "moderator"],
      default: "admin",
    },
    email: String,
    permissions: [String],
    lastLogin: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const AdminUser = mongoose.model("AdminUser", adminUserSchema);

export default AdminUser;
