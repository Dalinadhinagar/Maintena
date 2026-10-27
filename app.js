
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
require("dotenv").config();

const { connectDB } = require("./db");
const User = require("./User");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== SESSION CONFIGURATION ====================

app.use(
    session({
        name: "maintena.sid",
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 1000 * 60 * 60 * 2
        }
    })
);

// ==================== STATIC FILES ====================

app.use(
    express.static(path.join(__dirname, "public"), {
        index: false
    })
);

// ==================== LOGIN PROTECTION ====================

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        if (req.originalUrl.startsWith("/api/")) {
            return res.status(401).json({
                success: false,
                message: "Please log in to continue."
            });
        }

        return res.redirect("/");
    }

    next();
}

// ==================== DATABASE MODELS ====================

const assetSchema = new mongoose.Schema(
    {
        asset_code: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: String,
            required: true,
            trim: true
        },
        location: {
            type: String,
            required: true,
            trim: true
        },
        condition_status: {
            type: String,
            enum: ["Operational", "Needs Attention", "Under Repair"],
            default: "Operational"
        }
    },
    {
        timestamps: {
            createdAt: "created_at",
            updatedAt: "updated_at"
        }
    }
);

const faultSchema = new mongoose.Schema({
    asset_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Asset",
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
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
    reported_at: {
        type: Date,
        default: Date.now
    }
});

const workOrderSchema = new mongoose.Schema({
    asset_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Asset",
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
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
    scheduled_date: {
        type: Date,
        default: null
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

const Asset =
    mongoose.models.Asset || mongoose.model("Asset", assetSchema);

const Fault =
    mongoose.models.Fault || mongoose.model("Fault", faultSchema);

const WorkOrder =
    mongoose.models.WorkOrder ||
    mongoose.model("WorkOrder", workOrderSchema);

// ==================== WEBSITE PAGES ====================

app.get("/", (req, res) => {
    if (req.session.userId) {
        return res.redirect("/dashboard");
    }

    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/register", (req, res) => {
    if (req.session.userId) {
        return res.redirect("/dashboard");
    }

    res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/dashboard", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ==================== AUTHENTICATION ====================

app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Not logged in."
        });
    }

    res.json({
        success: true,
        user: {
            id: req.session.userId,
            name: req.session.userName,
            email: req.session.userEmail
        }
    });
});

// Register
app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all fields."
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanName.length < 2 || cleanName.length > 60) {
            return res.status(400).json({
                success: false,
                message: "Name must be between 2 and 60 characters."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address."
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must be between 8 and 72 characters."
            });
        }

        const existingUser = await User.findOne({
            email: cleanEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await User.create({
            name: cleanName,
            email: cleanEmail,
            passwordHash
        });

        req.session.regenerate((error) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Account created. Please log in."
                });
            }

            req.session.userId = user._id.toString();
            req.session.userName = user.name;
            req.session.userEmail = user.email;

            req.session.save((saveError) => {
                if (saveError) {
                    return res.status(500).json({
                        success: false,
                        message: "Account created. Please log in."
                    });
                }

                res.status(201).json({
                    success: true,
                    message: "Account created successfully.",
                    redirect: "/dashboard"
                });
            });
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        console.error("Registration error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to create account right now."
        });
    }
});

// Login
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter your email and password."
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (
            !user ||
            !(await bcrypt.compare(password, user.passwordHash))
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Unable to start your session."
                });
            }

            req.session.userId = user._id.toString();
            req.session.userName = user.name;
            req.session.userEmail = user.email;

            req.session.save((saveError) => {
                if (saveError) {
                    return res.status(500).json({
                        success: false,
                        message: "Unable to save your login session."
                    });
                }

                res.json({
                    success: true,
                    message: "Login successful.",
                    redirect: "/dashboard"
                });
            });
        });
    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to log in right now."
        });
    }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                success: false,
                message: "Unable to log out."
            });
        }

        res.clearCookie("maintena.sid");

        res.json({
            success: true,
            redirect: "/"
        });
    });
});

// ==================== DATABASE TEST ====================

app.get("/api/test-db", async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();

        res.json({
            success: true,
            message: "MongoDB connected successfully.",
            database: mongoose.connection.name
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "MongoDB connection test failed."
        });
    }
});

// Protect maintenance APIs
app.use("/api/dashboard", requireLogin);
app.use("/api/assets", requireLogin);
app.use("/api/faults", requireLogin);
app.use("/api/work-orders", requireLogin);

// ==================== DASHBOARD ====================

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
            success: false,
            message: "Unable to load dashboard."
        });
    }
});

// ==================== ASSETS ====================

// Get all assets
app.get("/api/assets", async (req, res) => {
    try {
        const assets = await Asset.find().sort({
            created_at: -1
        });

        res.json(
            assets.map((asset) => ({
                id: asset._id.toString(),
                asset_code: asset.asset_code,
                name: asset.name,
                category: asset.category,
                location: asset.location,
                condition_status: asset.condition_status,
                created_at: asset.created_at
            }))
        );
    } catch (error) {
        console.error("Load assets error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load assets."
        });
    }
});

// Add an asset
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
            typeof asset_code !== "string" ||
            typeof name !== "string" ||
            typeof category !== "string" ||
            typeof location !== "string" ||
            !asset_code.trim() ||
            !name.trim() ||
            !category.trim() ||
            !location.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all asset fields."
            });
        }

        const allowedConditions = [
            "Operational",
            "Needs Attention",
            "Under Repair"
        ];

        if (
            condition_status &&
            !allowedConditions.includes(condition_status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid asset condition."
            });
        }

        const asset = await Asset.create({
            asset_code: asset_code.trim().toUpperCase(),
            name: name.trim(),
            category: category.trim(),
            location: location.trim(),
            condition_status: condition_status || "Operational"
        });

        res.status(201).json({
            success: true,
            message: "Asset added successfully.",
            asset: {
                id: asset._id.toString(),
                asset_code: asset.asset_code,
                name: asset.name,
                category: asset.category,
                location: asset.location,
                condition_status: asset.condition_status
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "That asset code already exists."
            });
        }

        console.error("Add asset error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to add asset."
        });
    }
});

// Edit an asset
app.put("/api/assets/:id", async (req, res) => {
    try {
        const {
            asset_code,
            name,
            category,
            location,
            condition_status
        } = req.body;

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid asset ID."
            });
        }

        if (
            typeof asset_code !== "string" ||
            typeof name !== "string" ||
            typeof category !== "string" ||
            typeof location !== "string" ||
            !asset_code.trim() ||
            !name.trim() ||
            !category.trim() ||
            !location.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all asset fields."
            });
        }

        const allowedConditions = [
            "Operational",
            "Needs Attention",
            "Under Repair"
        ];

        if (!allowedConditions.includes(condition_status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid asset condition."
            });
        }

        const updatedAsset = await Asset.findByIdAndUpdate(
            req.params.id,
            {
                asset_code: asset_code.trim().toUpperCase(),
                name: name.trim(),
                category: category.trim(),
                location: location.trim(),
                condition_status
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedAsset) {
            return res.status(404).json({
                success: false,
                message: "Asset not found."
            });
        }

        res.json({
            success: true,
            message: "Asset updated successfully."
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "That asset code is already in use."
            });
        }

        console.error("Update asset error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to update asset."
        });
    }
});

// Delete an asset
app.delete("/api/assets/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid asset ID."
            });
        }

        const asset = await Asset.findById(req.params.id);

        if (!asset) {
            return res.status(404).json({
                success: false,
                message: "Asset not found."
            });
        }

        const [relatedFault, relatedOrder] = await Promise.all([
            Fault.exists({ asset_id: asset._id }),
            WorkOrder.exists({ asset_id: asset._id })
        ]);

        if (relatedFault || relatedOrder) {
            return res.status(409).json({
                success: false,
                message:
                    "This asset has related fault reports or work orders. It cannot be deleted until those records are removed."
            });
        }

        await Asset.findByIdAndDelete(asset._id);

        res.json({
            success: true,
            message: "Asset deleted successfully."
        });
    } catch (error) {
        console.error("Delete asset error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to delete asset."
        });
    }
});

// ==================== FAULTS ====================

// Get all faults
app.get("/api/faults", async (req, res) => {
    try {
        const faults = await Fault.find()
            .populate("asset_id", "asset_code name")
            .sort({ reported_at: -1 });

        res.json(
            faults.map((fault) => ({
                id: fault._id.toString(),
                asset_id: fault.asset_id?._id?.toString() || "",
                asset_code: fault.asset_id?.asset_code || "Unknown",
                asset_name: fault.asset_id?.name || "Unknown asset",
                description: fault.description,
                severity: fault.severity,
                status: fault.status,
                reported_at: fault.reported_at
            }))
        );
    } catch (error) {
        console.error("Load faults error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load fault reports."
        });
    }
});

// Report a fault
app.post("/api/faults", async (req, res) => {
    try {
        const { asset_id, description, severity } = req.body;

        if (
            !mongoose.isValidObjectId(asset_id) ||
            typeof description !== "string" ||
            !description.trim() ||
            !["Low", "Medium", "High", "Critical"].includes(severity)
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid asset, description, and severity."
            });
        }

        const asset = await Asset.findById(asset_id);

        if (!asset) {
            return res.status(404).json({
                success: false,
                message: "Selected asset was not found."
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
            success: true,
            message: "Fault reported successfully.",
            id: fault._id.toString()
        });
    } catch (error) {
        console.error("Report fault error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to report fault."
        });
    }
});

// Update fault status
app.patch("/api/faults/:id/status", async (req, res) => {
    try {
        const { status } = req.body;

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid fault ID."
            });
        }

        if (!["Open", "In Progress", "Resolved"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid fault status."
            });
        }

        const fault = await Fault.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!fault) {
            return res.status(404).json({
                success: false,
                message: "Fault not found."
            });
        }

        res.json({
            success: true,
            message: "Fault status updated."
        });
    } catch (error) {
        console.error("Update fault error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to update fault status."
        });
    }
});

// ==================== WORK ORDERS ====================

// Get all work orders
app.get("/api/work-orders", async (req, res) => {
    try {
        const orders = await WorkOrder.find()
            .populate("asset_id", "asset_code name")
            .sort({ created_at: -1 });

        res.json(
            orders.map((order) => ({
                id: order._id.toString(),
                asset_id: order.asset_id?._id?.toString() || "",
                asset_code: order.asset_id?.asset_code || "Unknown",
                asset_name: order.asset_id?.name || "Unknown asset",
                title: order.title,
                priority: order.priority,
                status: order.status,
                scheduled_date: order.scheduled_date,
                created_at: order.created_at
            }))
        );
    } catch (error) {
        console.error("Load work orders error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load work orders."
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
            scheduled_date
        } = req.body;

        if (
            !mongoose.isValidObjectId(asset_id) ||
            typeof title !== "string" ||
            !title.trim() ||
            !["Low", "Medium", "High", "Critical"].includes(priority)
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid asset, task title, and priority."
            });
        }

        const asset = await Asset.findById(asset_id);

        if (!asset) {
            return res.status(404).json({
                success: false,
                message: "Selected asset was not found."
            });
        }

        let parsedDate = null;

        if (scheduled_date) {
            parsedDate = new Date(scheduled_date);

            if (Number.isNaN(parsedDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid scheduled date."
                });
            }
        }

        const order = await WorkOrder.create({
            asset_id,
            title: title.trim(),
            priority,
            scheduled_date: parsedDate
        });

        res.status(201).json({
            success: true,
            message: "Work order created successfully.",
            id: order._id.toString()
        });
    } catch (error) {
        console.error("Create work order error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to create work order."
        });
    }
});

// Update work-order status
app.patch("/api/work-orders/:id/status", async (req, res) => {
    try {
        const { status } = req.body;

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid work order ID."
            });
        }

        if (!["Pending", "In Progress", "Completed"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid work order status."
            });
        }

        const order = await WorkOrder.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Work order not found."
            });
        }

        res.json({
            success: true,
            message: "Work order status updated."
        });
    } catch (error) {
        console.error("Update work order error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to update work order status."
        });
    }
});

// ==================== ERROR HANDLING ====================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// ==================== START SERVER ====================

async function startServer() {
    try {
        if (!process.env.SESSION_SECRET) {
            throw new Error(
                "SESSION_SECRET is missing from your .env file."
            );
        }

        await connectDB();

        app.listen(PORT, () => {
            console.log(
                `Maintena is running at http://localhost:${PORT}`
            );
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
}

startServer();
