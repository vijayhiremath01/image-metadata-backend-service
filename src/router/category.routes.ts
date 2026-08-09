import { Router } from "express";
import { getAllCategories, getCategoryBySlugController } from "@/controller/category.controller";
import photoRouter from "@/router/photo.routes";

const router = Router();

router.get("/", getAllCategories);

router.get("/:slug", getCategoryBySlugController);

router.get("/:slug/photos", (req, res, next) => {
  req.url = `/category/${req.params.slug}`;
  photoRouter(req, res, next);
});

export default router;