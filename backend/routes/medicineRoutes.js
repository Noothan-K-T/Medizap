import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
  name: String,
  brand: String,
  quantity: Number,
  price: Number,
});

export default mongoose.model("Medicine", medicineSchema);