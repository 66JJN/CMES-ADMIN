import mongoose from "mongoose";

const rankingSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      default: null,
    },
    avatar: {
      type: String,
      default: null,
    },
    points: {
      type: Number,
      required: true,
      default: 0,
    },
    rank: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Auto-update rank field based on points
rankingSchema.pre("save", async function () {
  const ranking = this;
  const totalBefore = await mongoose.model("Ranking").countDocuments({
    points: { $gt: ranking.points },
  });
  ranking.rank = totalBefore + 1;
});

// Index for faster queries
rankingSchema.index({ points: -1 });
rankingSchema.index({ rank: 1 });

const Ranking = mongoose.model("Ranking", rankingSchema);

export default Ranking;
