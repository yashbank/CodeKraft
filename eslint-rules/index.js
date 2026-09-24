import noFloatMoney from "./no-float-money.js";
import noEdgeRuntime from "./no-edge-runtime.js";
import noHardcodedColors from "./no-hardcoded-colors.js";

export default {
  meta: { name: "codekraft", version: "1.0.0" },
  rules: {
    "no-float-money": noFloatMoney,
    "no-edge-runtime": noEdgeRuntime,
    "no-hardcoded-colors": noHardcodedColors,
  },
};
