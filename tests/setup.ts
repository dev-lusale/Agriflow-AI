// Tests always run against the isolated test database (never the dev/demo DB).
const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:agriflow@localhost:5544/agriflow_test";
process.env.DATABASE_URL = TEST_DB;
process.env.DIRECT_URL = TEST_DB;
process.env.AUTH_SECRET = "test-secret-not-for-production";
process.env.XAI_API_KEY = "";
process.env.RESEND_API_KEY = "";
process.env.APP_URL = "http://localhost:3000";
