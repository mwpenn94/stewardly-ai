# @platform/* Extraction Roadmap

## Purpose

This document specifies the 10 @platform/* packages to be extracted from the Stewardly monolith, including source locations, public API surfaces, dependency requirements, and migration steps.

## Package Specifications

### 1. @platform/data-pipelines

**Source**: `server/services/governmentDataPipelines.ts` (1,950 lines)

**Public API**:
```typescript
export function runAllPipelines(): Promise<PipelineResult[]>
export function runSinglePipeline(slug: string): Promise<PipelineResult>
export function fetchFREDData(): Promise<PipelineResult>
export function fetchBLSData(): Promise<PipelineResult>
export function fetchBEAData(): Promise<PipelineResult>
export function fetchCensusData(): Promise<PipelineResult>
export function fetchSECEdgarData(): Promise<PipelineResult>
export function fetchFINRAData(): Promise<PipelineResult>
export function fetchTreasuryFiscalData(): Promise<PipelineResult>
export function fetchGLEIFData(): Promise<PipelineResult>
export function fetchWorldBankData(): Promise<PipelineResult>
export function fetchOpenFIGIData(): Promise<PipelineResult>
export function fetchNAICData(): Promise<PipelineResult>
export function fetchFFIECData(): Promise<PipelineResult>
export function fetchFDICData(): Promise<PipelineResult>
export function fetchCoinGeckoData(): Promise<PipelineResult>
export function fetchIMFData(): Promise<PipelineResult>
export function fetchExchangeRateData(): Promise<PipelineResult>
```

**Dependencies**: `node:fetch` (built-in), circuit breaker utility (extract inline)
**DB coupling**: `storeDataPoints()` → inject via adapter pattern
**Migration**: Replace direct DB calls with `StorageAdapter` interface

### 2. @platform/compliance

**Source**: `server/services/compliance/` (multiple files)

**Public API**:
```typescript
export function stripPII(text: string): { cleaned: string; findings: PIIFinding[] }
export function addDisclaimer(response: string, mode: FocusMode): string
export function createAuditEntry(action: AuditAction, ctx: AuditContext): Promise<void>
export function checkSuitabilityGate(userId: string): Promise<GateResult>
```

**Dependencies**: None (pure logic + DB adapter)
**Migration**: Inject DB adapter for audit persistence

### 3. @platform/sharing-ui

**Source**: `client/src/components/sharing/ShareKit.tsx` (516 lines)

**Public API**:
```typescript
export function ShareButton(props: ShareButtonProps): JSX.Element
export function RecipientPicker(props: RecipientPickerProps): JSX.Element
export function PermissionSelector(props: PermissionSelectorProps): JSX.Element
export function OmissionToggle(props: OmissionToggleProps): JSX.Element
export function SharingStatusIndicator(props: SharingStatusProps): JSX.Element
```

**Dependencies**: React, shadcn/ui, Tailwind
**Migration**: Copy component + extract shared types

### 4. @platform/disclosure

**Source**: `client/src/contexts/DisclosureContext.tsx` + `client/src/components/DisclosureSection.tsx`

**Public API**:
```typescript
export type DisclosureLevel = "essential" | "standard" | "professional" | "expert"
export function DisclosureProvider(props: { children: ReactNode }): JSX.Element
export function useDisclosure(): { level: DisclosureLevel; setLevel: (l: DisclosureLevel) => void }
export function useDisclosureGate(minLevel: DisclosureLevel): boolean
export function DisclosureSection(props: { minLevel: DisclosureLevel; children: ReactNode }): JSX.Element
```

**Dependencies**: React
**Migration**: Direct copy, no DB coupling

### 5. @platform/voice

**Source**: `server/services/edgeTTS.ts` + `server/services/deepgramService.ts`

**Public API**:
```typescript
export function synthesizeSpeech(text: string, voice: string): Promise<Buffer>
export function listVoices(): Voice[]
export function transcribeAudio(audioUrl: string, options?: TranscribeOptions): Promise<TranscriptResult>
```

**Dependencies**: Edge TTS SDK, Deepgram SDK
**Migration**: Extract with API key injection

### 6. @platform/video

**Source**: `server/services/dailyService.ts` + `server/routers/videoConferencing.ts`

**Public API**:
```typescript
export function createRoom(options?: RoomOptions): Promise<Room | DailyError>
export function getRoom(name: string): Promise<Room | DailyError>
export function deleteRoom(name: string): Promise<void>
export function createMeetingToken(roomName: string, userId: string): Promise<string>
export function listRooms(): Promise<Room[]>
export function getRoomRecordings(roomName: string): Promise<Recording[]>
```

**Dependencies**: Daily.co REST API
**Migration**: Extract with API key injection

### 7. @platform/comms

**Source**: `server/commsEngine.ts` + `server/routers/emailCampaign.ts`

**Public API**:
```typescript
export function listTemplates(): Template[]
export function renderTemplate(id: string, variables: Record<string, string>): string
export function createCampaign(config: CampaignConfig): Promise<Campaign>
export function sendCampaign(campaignId: string): Promise<SendResult>
```

**Dependencies**: None (pure logic + email adapter)
**Migration**: Inject email sending adapter

### 8. @platform/premium-finance

**Source**: `server/services/premiumFinance/` (multiple files)

**Public API**:
```typescript
export function fetchLatestSofr(): Promise<SofrRate | null>
export function getRateHistory(days?: number): Promise<SofrRate[]>
export function modelLoan(params: LoanParams): LoanProjection
```

**Dependencies**: FRED API
**Migration**: Extract with API key injection + DB adapter for rate persistence

### 9. @platform/auth

**Source**: `server/_core/oauth.ts` + `server/_core/context.ts`

**Public API**:
```typescript
export function createOAuthHandler(config: OAuthConfig): express.Router
export function createSessionMiddleware(secret: string): express.RequestHandler
export function buildContext(req: express.Request): Promise<AppContext>
```

**Dependencies**: express, jsonwebtoken
**Migration**: Extract with configuration injection

### 10. @platform/storage

**Source**: `server/storage.ts`

**Public API**:
```typescript
export function storagePut(key: string, data: Buffer | string, contentType?: string): Promise<{ key: string; url: string }>
export function storageGet(key: string, expiresIn?: number): Promise<{ key: string; url: string }>
```

**Dependencies**: @aws-sdk/client-s3
**Migration**: Direct copy with env injection

## Extraction Order

The extraction order respects the dependency graph (leaf packages first):

1. @platform/storage (no deps)
2. @platform/disclosure (React only)
3. @platform/sharing-ui (React + shadcn)
4. @platform/voice (external APIs)
5. @platform/video (external APIs)
6. @platform/compliance (pure logic)
7. @platform/comms (pure logic)
8. @platform/premium-finance (FRED API)
9. @platform/data-pipelines (multiple APIs)
10. @platform/auth (express + JWT)

## Verification Protocol

After each package extraction:
1. Run `pnpm turbo build` — must complete without errors
2. Run `pnpm turbo test` — must maintain 9,669+ passing tests
3. Run Stewardly app — must serve without errors
4. Verify the extracted package builds independently
5. Verify the extracted package's tests pass independently
