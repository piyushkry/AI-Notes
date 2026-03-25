import express from "express"
import isAuth from "../middleware/isAuth.js"
import { createCreditsOrder, verifyPayment } from "../controllers/credits.controller.js"

const creditRouter = express.Router()
creditRouter.post("/order" , isAuth ,createCreditsOrder )
creditRouter.post("/verify-payment", isAuth, verifyPayment)

export default creditRouter