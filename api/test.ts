export default async function handler(req: any, res: any) {
  try {
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || "production",
        vercel: !!process.env.VERCEL,
        vercelUrl: process.env.VERCEL_URL || "unknown",
        appUrl: process.env.APP_URL || "unknown"
      },
      message: "TraderPro254 API is running ✓"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
