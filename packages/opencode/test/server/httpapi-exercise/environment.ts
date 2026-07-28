import { Flag } from "@opencode-ai/core/flag/flag"
import { Effect } from "effect"
import path from "path"

const preserveExerciseGlobalRoot = !!process.env.DEEPCODE_HTTPAPI_EXERCISE_GLOBAL
export const exerciseGlobalRoot =
  process.env.DEEPCODE_HTTPAPI_EXERCISE_GLOBAL ??
  path.join(process.env.TMPDIR ?? "/tmp", `deepcode-httpapi-global-${process.pid}`)
process.env.XDG_DATA_HOME = path.join(exerciseGlobalRoot, "data")
process.env.XDG_CONFIG_HOME = path.join(exerciseGlobalRoot, "config")
process.env.XDG_STATE_HOME = path.join(exerciseGlobalRoot, "state")
process.env.XDG_CACHE_HOME = path.join(exerciseGlobalRoot, "cache")
process.env.DEEPCODE_DISABLE_SHARE = "true"
export const exerciseConfigDirectory = path.join(exerciseGlobalRoot, "config", "deepcode")
export const exerciseDataDirectory = path.join(exerciseGlobalRoot, "data", "deepcode")

const preserveExerciseDatabase = !!process.env.DEEPCODE_HTTPAPI_EXERCISE_DB
export const exerciseDatabasePath =
  process.env.DEEPCODE_HTTPAPI_EXERCISE_DB ??
  path.join(process.env.TMPDIR ?? "/tmp", `deepcode-httpapi-exercise-${process.pid}.db`)
process.env.DEEPCODE_DB = exerciseDatabasePath
// Internal property names remain upstream-compatible; user-facing environment names do not.
Flag.DEEPCODE_DB = exerciseDatabasePath

export const original = {
  DEEPCODE_SERVER_PASSWORD: Flag.DEEPCODE_SERVER_PASSWORD,
  DEEPCODE_SERVER_USERNAME: Flag.DEEPCODE_SERVER_USERNAME,
}

export const cleanupExercisePaths = Effect.promise(async () => {
  const fs = await import("fs/promises")
  if (!preserveExerciseDatabase) {
    await Promise.all(
      [exerciseDatabasePath, `${exerciseDatabasePath}-wal`, `${exerciseDatabasePath}-shm`].map((file) =>
        fs.rm(file, { force: true }).catch(() => undefined),
      ),
    )
  }
  if (!preserveExerciseGlobalRoot)
    await fs.rm(exerciseGlobalRoot, { recursive: true, force: true }).catch(() => undefined)
})
