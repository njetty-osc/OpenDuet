//! Legacy event types for setup IPC and local image-pull progress.
//! No emitter, installation identity, persistent queue, or network transport.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum EventData {
    StepViewed {
        step: Step,
    },
    HarnessChosen {
        harness: Harness,
    },
    ModelChosen {
        provider: Provider,
        credential_path: CredentialPath,
        custom_base_url: bool,
    },
    EngineDetected {
        engine: Engine,
        responding: bool,
    },
    EngineInstalled {
        engine: Engine,
        outcome: EngineInstallOutcome,
    },
    WindowsStage {
        outcome: WindowsStageOutcome,
    },
    ImagePull {
        outcome: Outcome,
        duration_ms: u64,
        bytes: Option<u64>,
    },
    SetupFailed {
        step: Step,
        error_class: SetupErrorClass,
    },
    Activated,
    SetupAbandoned {
        step: Step,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Step {
    Welcome,
    Harness,
    Install,
    Model,
    Connect,
    Ask,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Harness {
    Crewai,
    Llamaindex,
    Agno,
    Langgraph,
    GoogleAdk,
    PydanticAi,
    MicrosoftAgentFramework,
    ClaudeAgentSdk,
    Strands,
    Ag2,
    Langroid,
    Mastra,
    ByoUrl,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Provider {
    Openai,
    Anthropic,
    Compatible,
    None,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CredentialPath {
    Subscription,
    ApiKey,
    None,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Engine {
    Docker,
    Podman,
    None,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EngineInstallOutcome {
    Success,
    Failure,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WindowsStageOutcome {
    Ready,
    WslAbsent,
    WslOne,
    WslNoKernel,
    VirtualMachinePlatformDisabled,
    VirtualizationDisabled,
    NotAdministrator,
    CheckFailed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Success,
    Failure,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SetupErrorClass {
    EngineUnavailable,
    EngineInstallFailed,
    ImagePullFailed,
    InvalidConfiguration,
    NetworkUnavailable,
    PermissionDenied,
    Unknown,
}
