const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const app = express();

const statuses = [
  "Reported",
  "Assigned",
  "In progress",
  "Resolved",
];

// Allow requests from the React frontend.
app.use(
  cors({
    origin:
      process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);

// Read JSON sent by the frontend.
app.use(express.json({ limit: "100kb" }));

// Define how reports are stored in MongoDB.
const reportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    technician: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    status: {
      type: String,
      enum: statuses,
      default: "Reported",
    },

    history: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Report = mongoose.model("Report", reportSchema);

// Validate text before saving it.
function validText(value, maximum, allowEmpty = false) {
  return (
    typeof value === "string" &&
    (allowEmpty || value.trim().length > 0) &&
    value.trim().length <= maximum
  );
}

// Basic welcome route.
app.get("/", (req, res) => {
  res.json({
    message: "FixTrack backend is running.",
    healthCheck: "/api/health",
    reports: "/api/reports",
  });
});

// Check the backend and database connection.
app.get("/api/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    message: "FixTrack API",
    database: connected ? "Connected" : "Disconnected",
  });
});

// GET: Retrieve all reports.
app.get("/api/reports", async (req, res, next) => {
  try {
    const reports = await Report.find().sort({
      createdAt: -1,
    });

    res.json(reports);
  } catch (error) {
    next(error);
  }
});

// POST: Create a report.
app.post("/api/reports", async (req, res, next) => {
  try {
    const { title, location, description } = req.body || {};

    if (
      !validText(title, 100) ||
      !validText(location, 150) ||
      !validText(description, 2000)
    ) {
      return res.status(400).json({
        message:
          "Provide a title, location, and description within their length limits.",
      });
    }

    const report = await Report.create({
      title: title.trim(),
      location: location.trim(),
      description: description.trim(),
      history: [
        `${new Date().toISOString()}: Report created`,
      ],
    });

    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

// PATCH: Update a technician or repair status.
app.patch("/api/reports/:id", async (req, res, next) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({
        message: "Invalid report ID.",
      });
    }

    const body = req.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        message: "Provide an update object.",
      });
    }

    const fields = Object.keys(body);

    if (
      fields.length === 0 ||
      fields.some(
        (field) => !["status", "technician"].includes(field)
      )
    ) {
      return res.status(400).json({
        message: "Only status and technician can be updated.",
      });
    }

    if (
      "status" in body &&
      !statuses.includes(body.status)
    ) {
      return res.status(400).json({
        message: "Invalid repair status.",
      });
    }

    if (
      "technician" in body &&
      !validText(body.technician, 100, true)
    ) {
      return res.status(400).json({
        message:
          "Technician must be text of up to 100 characters.",
      });
    }

    const updates = {};
    const historyEntries = [];
    const timestamp = new Date().toISOString();

    if ("status" in body) {
      updates.status = body.status;

      historyEntries.push(
        `${timestamp}: Status set to ${body.status}`
      );
    }

    if ("technician" in body) {
      updates.technician = body.technician.trim();

      historyEntries.push(
        `${timestamp}: Technician set to ${
          updates.technician || "Unassigned"
        }`
      );
    }

    // Save the changes and history in one database operation.
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        $set: updates,
        $push: {
          history: {
            $each: historyEntries,
          },
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!report) {
      return res.status(404).json({
        message: "Report not found.",
      });
    }

    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Handle unknown routes.
app.use((req, res) => {
  res.status(404).json({
    message: "API route not found.",
  });
});

// Handle errors.
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Request body contains invalid JSON.",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body is too large.",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Report data failed validation.",
    });
  }

  console.error("API error:", error.message);

  res.status(500).json({
    message: "A server error occurred. Please try again.",
  });
});

// Connect to MongoDB before starting the API.
async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from server/.env");
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("MongoDB connected");

    const port = Number(process.env.PORT) || 5000;

    const server = app.listen(port, "127.0.0.1", () => {
      console.log(`FixTrack API: http://localhost:${port}`);
    });

    server.on("error", (error) => {
      console.error(
        "Server could not start:",
        error.message
      );

      process.exit(1);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

startServer();