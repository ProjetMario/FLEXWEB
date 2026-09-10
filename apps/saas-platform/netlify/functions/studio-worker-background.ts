import { secretMatches } from "../../lib/automation/core";
import { runStudioWorker } from "../../lib/studio/worker";
export default async (request: Request) => {
  if (
    !secretMatches(
      request.headers.get("x-automation-secret"),
      Netlify.env.get("AUTOMATION_SHARED_SECRET"),
    )
  )
    return new Response("Unauthorized", { status: 401 });
  await runStudioWorker();
  return new Response("Done");
};
