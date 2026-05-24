import { Router, type IRouter } from "express";
import healthRouter from "./health";
import payheroRouter from "./payhero";
import userRouter from "./user";

const router: IRouter = Router();

router.use(healthRouter);
router.use(payheroRouter);
router.use(userRouter);

export default router;
