
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const { connectDB } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// -------------------- DATABASE MODELS --------------------

const assetSchema = new mongoose.Schema({
    asset_code: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
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
    asset_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Asset",
        required: true
    },
    description: { type: String, required: true, trim: true },
    severity: {
        type: String,
        enum: ["Low", "Medium", "High", "Critical"],
        required: true
    },
    status: {
        type: String,
        enum: ["Open", "In Progress", "Resolved"],
        default: "Open"
    },
    reported_at: { type: Date, default: Date.now }
});

const workOrderSchema = new mongoose.Schema({
    asset_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Asset",
        required: true
    },
    title: { type: String, required: true, trim: true },
    priority: {
        type: String,
        enum: ["Low", "Medium", "High", "Critical"],
        default: "Medium"
    },
    status: {
        type: String,
        enum: ["Pending", "In Progress", "Completed"],
        default: "Pending"
    },
    scheduled_date: { type: Date, default: null },
    created_at: { type: Date, default: Date.now }
});

const Asset = mongoose.models.Asset ||
    mongoose.model("Asset", assetSchema);

const Fault = mongoose.models.Fault ||
    mongoose.model("Fault", faultSchema);

const WorkOrder = mongoose.models.WorkOrder ||
    mongoose.model("WorkOrder", workOrderSchema);

// Convert MongoDB documents to the format expected by the frontend.
function formatAsset(asset) {
    return {
        id: asset._id.toString(),
        asset_code: asset.asset_code,
        name: asset.name,
        category: asset.category,
        location: asset.location,
        condition_status: asset.condition_status,
        created_at: asset.created_at
    };
}

function formatRelatedRecord(record) {
    const asset = record.asset_id;

    return {
        id: record._id.toString(),
        asset_id: asset?._id?.toString() || "",
        asset_code: asset?.asset_code || "",
        asset_name: asset?.name || "",
        description: record.description,
        severity: record.severity,
        status: record.status,
        reported_at: record.reported_at,
        title: record.title,
        priority: record.priority,
        scheduled_date: record.scheduled_date,
        created_at: record.created_at
    };
}

function validId(id) {
    return mongoose.isValidObjectId(id);
}

// -------------------- MAIN PAGE --------------------

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// -------------------- DATABASE TEST --------------------

app.get("/api/test-db", async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();

        res.json({
            success: true,
            message: "MongoDB connected successfully.",
            database: mongoose.connection.name
        });
    } catch (error) {
        console.error("Database test error:", error.message);
        res.status(500).json({
            success: false,
            message: "MongoDB connection failed."
        });
    }
});

// -------------------- DASHBOARD --------------------

app.get("/api/dashboard", async (req, res) => {
    try {
        const totalAssets = await Asset.countDocuments();
        const openFaults = await Fault.countDocuments({
            status: { $ne: "Resolved" }
        });
        const underRepair = await Asset.countDocuments({
            condition_status: "Under Repair"
        });
        const pendingOrders = await WorkOrder.countDocuments({
            status: "Pending"
        });

        res.json({
            totalAssets,
            openFaults,
            underRepair,
            pendingOrders
        });
    } catch (error) {
        console.error("Dashboard error:", error.message);
        res.status(500).json({
            message: "Could not load dashboard statistics."
        });
    }
});

// -------------------- ASSETS --------------------

// Get all assets
app.get("/api/assets", async (req, res) => {
    try {
        const assets = await Asset.find().sort({ created_at: -1 });
        res.json(assets.map(formatAsset));
    } catch (error) {
        console.error("Get assets error:", error.message);
        res.status(500).json({
            message: "Could not retrieve assets."
        });
    }
});

// Register a new asset
app.post("/api/assets", async (req, res) => {
    try {
        const {
            asset_code,
            name,
            category,
            location,
            condition_status
        } = req.body;

        if (
            typeof asset_code !== "string" || !asset_code.trim() ||
            typeof name !== "string" || !name.trim() ||
            typeof category !== "string" || !category.trim() ||
            typeof location !== "string" || !location.trim()
        ) {
            return res.status(400).json({
                message: "Please fill in all required asset fields."
            });
        }

        const condition = condition_status || "Operational";
        const validConditions = [
            "Operational",
            "Needs Attention",
            "Under Repair"
        ];

        if (!validConditions.includes(condition)) {
            return res.status(400).json({
                message: "Please select a valid asset condition."
            });
        }

        const asset = await Asset.create({
            asset_code: asset_code.trim(),
            name: name.trim(),
            category: category.trim(),
            location: location.trim(),
            condition_status: condition
        });

        res.status(201).json({
            message: "Asset registered successfully.",
            id: asset._id.toString()
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "This asset code already exists. Please use a different code."
            });
        }

        console.error("Register asset error:", error.message);
        res.status(500).json({
            message: "Could not register asset."
        });
    }
});

// -------------------- FAULT REPORTS --------------------

// Get fault reports
app.get("/api/faults", async (req, res) => {
    try {
        const faults = await Fault.find()
            .populate("asset_id", "asset_code name")
            .sort({ reported_at: -1 });

        res.json(faults.map(formatRelatedRecord));
    } catch (error) {
        console.error("Get faults error:", error.message);
        res.status(500).json({
            message: "Could not retrieve fault reports."
        });
    }
});

// Report a fault
app.post("/api/faults", async (req, res) => {
    try {
        const { asset_id, description, severity } = req.body;

        if (
            !validId(asset_id) ||
            typeof description !== "string" ||
            !description.trim() ||
            !severity
        ) {
            return res.status(400).json({
                message: "Please select an asset and provide a description and severity."
            });
        }

        const validSeverities = ["Low", "Medium", "High", "Critical"];

        if (!validSeverities.includes(severity)) {
            return res.status(400).json({
                message: "Please select a valid fault severity."
            });
        }

        const asset = await Asset.findById(asset_id);

        if (!asset) {
            return res.status(400).json({
                message: "The selected asset does not exist."
            });
        }

        const fault = await Fault.create({
            asset_id,
            description: description.trim(),
            severity
        });

        if (asset.condition_status !== "Under Repair") {
            asset.condition_status = "Needs Attention";
            await asset.save();
        }

        res.status(201).json({
            message: "Fault reported successfully.",
            id: fault._id.toString()
        });
    } catch (error) {
        console.error("Report fault error:", error.message);
        res.status(500).json({
            message: "Could not submit fault report."
        });
    }
});

// Update fault status
app.patch("/api/faults/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!validId(id)) {
            return res.status(400).json({
                message: "Invalid fault ID."
            });
        }

        if (!["Open", "In Progress", "Resolved"].includes(status)) {
            return res.status(400).json({
                message: "Please select a valid fault status."
            });
        }

        const fault = await Fault.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        );

        if (!fault) {
            return res.status(404).json({
                message: "Fault report not found."
            });
        }

        res.json({
            message: "Fault status updated successfully."
        });
    } catch (error) {
        console.error("Update fault error:", error.message);
        res.status(500).json({
            message: "Could not update fault status."
        });
    }
});

// -------------------- WORK ORDERS --------------------

// Get work orders
app.get("/api/work-orders", async (req, res) => {
    try {
        const orders = await WorkOrder.find()
            .populate("asset_id", "asset_code name")
            .sort({ created_at: -1 });

        res.json(orders.map(formatRelatedRecord));
    } catch (error) {
        console.error("Get work orders error:", error.message);
        res.status(500).json({
            message: "Could not retrieve work orders."
        });
    }
});

// Create a work order
app.post("/api/work-orders", async (req, res) => {
    try {
        const {
            asset_id,
            title,
            priority,
            status,
            scheduled_date
        } = req.body;

        if (
            !validId(asset_id) ||
            typeof title !== "string" ||
            !title.trim()
        ) {
            return res.status(400).json({
                message: "Please select an asset and enter a task title."
            });
        }

        const validPriorities = ["Low", "Medium", "High", "Critical"];
        const validStatuses = ["Pending", "In Progress", "Completed"];

        const chosenPriority = priority || "Medium";
        const chosenStatus = status || "Pending";

        if (!validPriorities.includes(chosenPriority)) {
            return res.status(400).json({
                message: "Please select a valid priority."
            });
        }

        if (!validStatuses.includes(chosenStatus)) {
            return res.status(400).json({
                message: "Please select a valid work order status."
            });
        }

        if (scheduled_date && Number.isNaN(Date.parse(scheduled_date))) {
            return res.status(400).json({
                message: "Please provide a valid scheduled date."
            });
        }

        const asset = await Asset.findById(asset_id);

        if (!asset) {
            return res.status(400).json({
                message: "The selected asset does not exist."
            });
        }

        const order = await WorkOrder.create({
            asset_id,
            title: title.trim(),
            priority: chosenPriority,
            status: chosenStatus,
            scheduled_date: scheduled_date || null
        });

        res.status(201).json({
            message: "Work order created successfully.",
            id: order._id.toString()
        });
    } catch (error) {
        console.error("Create work order error:", error.message);
        res.status(500).json({
            message: "Could not create work order."
        });
    }
});

// Update work order status
app.patch("/api/work-orders/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!validId(id)) {
            return res.status(400).json({
                message: "Invalid work order ID."
            });
        }

        if (!["Pending", "In Progress", "Completed"].includes(status)) {
            return res.status(400).json({
                message: "Please select a valid work order status."
            });
        }

        const order = await WorkOrder.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        );

        if (!order) {
            return res.status(404).json({
                message: "Work order not found."
            });
        }

        res.json({
            message: "Work order status updated successfully."
        });
    } catch (error) {
        console.error("Update work order error:", error.message);
        res.status(500).json({
            message: "Could not update work order status."
        });
    }
});

// -------------------- UNKNOWN API ROUTES --------------------

app.use("/api", (req, res) => {
    res.status(404).json({
        message: "API endpoint not found."
    });
});

// -------------------- START SERVER --------------------

async function startServer() {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Maintena is running at http://localhost:${PORT}`);
    });
}

startServer();
