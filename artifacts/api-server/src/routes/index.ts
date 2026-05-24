import { Router, type IRouter } from "express";
import healthRouter from "./health";
import payheroRouter from "./payhero";

const router: IRouter = Router();

router.use(healthRouter);
router.use(payheroRouter);

export default router;
