import path from "path"

process.env.DEEPCODE_DB = ":memory:"
process.env.DEEPCODE_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.DEEPCODE_DISABLE_MODELS_FETCH = "true"
