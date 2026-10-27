
require("dotenv").config();

const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema({
    asset_code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    condition_status: {
        type: String,
        enum: ["Operational", "Needs Attention", "Under Repair"],
        default: "Operational"
    }
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

const faultSchema = new mongoose.Schema({
    asset_id: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true },
    description: { type: String, required: true },
    severity: { type: String, enum: ["Low", "Medium", "High", "Critical"], required: true },
    status: { type: String, enum: ["Open", "In Progress", "Resolved"], default: "Open" },
    reported_at: { type: Date, default: Date.now }
});

const workOrderSchema = new mongoose.Schema({
    asset_id: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true },
    title: { type: String, required: true },
    priority: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Medium" },
    status: { type: String, enum: ["Pending", "In Progress", "Completed"], default: "Pending" },
    scheduled_date: { type: Date, default: null },
    created_at: { type: Date, default: Date.now }
});

const Asset = mongoose.models.Asset || mongoose.model("Asset", assetSchema);
const Fault = mongoose.models.Fault || mongoose.model("Fault", faultSchema);
const WorkOrder = mongoose.models.WorkOrder || mongoose.model("WorkOrder", workOrderSchema);

async function seedDatabase() {
    try {
        await mongoose.connect(
            process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/maintena"
        );

        console.log("Connected to MongoDB.");

        const sampleAssets = [
            {
                asset_code: "AST-001",
                name: "CNC Machine",
                category: "Manufacturing Equipment",
                location: "Workshop A",
                condition_status: "Operational"
            },
            {
                asset_code: "AST-002",
                name: "Air Compressor",
                category: "Pneumatic Equipment",
                location: "Plant Room",
                condition_status: "Needs Attention"
            },
            {
                asset_code: "AST-003",
                name: "Cooling Pump",
                category: "Pump",
                location: "Workshop B",
                condition_status: "Under Repair"
            },
            {
                asset_code: "AST-004",
                name: "Power Generator",
                category: "Electrical Equipment",
                location: "Utility Room",
                condition_status: "Operational"
            }
        ];

        for (const item of sampleAssets) {
            await Asset.updateOne(
                { asset_code: item.asset_code },
                { $setOnInsert: item },
                { upsert: true }
            );
        }

        const assets = await Asset.find();
        const airCompressor = assets.find(a => a.asset_code === "AST-002");
        const coolingPump = assets.find(a => a.asset_code === "AST-003");

        await Fault.updateOne(
            { description: "Unusual vibration during operation", asset_id: airCompressor._id },
            {
                $setOnInsert: {
                    asset_id: airCompressor._id,
                    description: "Unusual vibration during operation",
                    severity: "High",
                    status: "Open"
                }
            },
            { upsert: true }
        );

        await Fault.updateOne(
            { description: "Cooling pump motor overheating", asset_id: coolingPump._id },
            {
                $setOnInsert: {
                    asset_id: coolingPump._id,
                    description: "Cooling pump motor overheating",
                    severity: "Critical",
                    status: "In Progress"
                }
            },
            { upsert: true }
        );

        await WorkOrder.updateOne(
            { title: "Inspect air compressor", asset_id: airCompressor._id },
            {
                $setOnInsert: {
                    asset_id: airCompressor._id,
                    title: "Inspect air compressor",
                    priority: "High",
                    status: "Pending",
                    scheduled_date: new Date("2026-10-29")
                }
            },
            { upsert: true }
        );

        await WorkOrder.updateOne(
            { title: "Repair cooling pump motor", asset_id: coolingPump._id },
            {
                $setOnInsert: {
                    asset_id: coolingPump._id,
                    title: "Repair cooling pump motor",
                    priority: "Critical",
                    status: "In Progress",
                    scheduled_date: new Date("2026-10-28")
                }
            },
            { upsert: true }
        );

        console.log("Sample data added successfully!");
        console.log("Assets:", await Asset.countDocuments());
        console.log("Fault reports:", await Fault.countDocuments());
        console.log("Work orders:", await WorkOrder.countDocuments());
    } catch (error) {
        console.error("Seed error:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedDatabase();
