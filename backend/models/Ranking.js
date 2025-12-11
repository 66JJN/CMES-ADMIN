import mongoose from "mongoose";

const rankingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
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
    avatar: String,
    email: String,
  },
  { timestamps: true }
);

// Auto-update rank field based on points
rankingSchema.pre("save", async function (next) {
  const ranking = this;
  const totalBefore = await mongoose.model("Ranking").countDocuments({
    points: { $gt: ranking.points },
  });
  ranking.rank = totalBefore + 1;
  next();
});

const Ranking = mongoose.model("Ranking", rankingSchema);

export default Ranking;
