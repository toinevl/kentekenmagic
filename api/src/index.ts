import { app } from "@azure/functions";
import "./functions/vehicle.js";
import "./functions/enrich.js";

app.setup({
  enableHttpStream: false
});
