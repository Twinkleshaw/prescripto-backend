import express from "express";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getDoctorDashboard,
  updateDoctor,
} from "../controllers/doctorController.js";
import { getAllPatients } from "../controllers/patientController.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Doctor updates own profile
router.put(
  "/update-profile",
  authenticate,
  authorizeRoles("doctor"),
  upload.single("image"),
  (req, res, next) => {
    console.log(req.headers["content-type"]);
    console.log(req.file);
    console.log(req.body);
    next();
  },
  upload.single("image"),
  updateDoctor,
);

router.get(
  "/patients-list",
  authenticate,
  authorizeRoles("doctor"),
  getAllPatients,
);

router.get(
  "/dashboard",
  authenticate,
  authorizeRoles("doctor"),
  getDoctorDashboard,
);

export default router;
