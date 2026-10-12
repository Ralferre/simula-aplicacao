import { useMemo, useState, useEffect, useRef } from 'react';
import { listPumps, getPump } from '../../data/catalog';
import { computeDrive, pulsesPerKg } from '../../domain/ga800/model';
import { lookupFlow } from '../../domain/catalog/lookup';
import { getPressureOption } from '../../domain/catalog/pressure';
import type { Mode2Config } from '../../domain/simulation/mode2';
import { PumpSelect } from '../components/PumpSelect';
import { PressureSelect } from '../components/PressureSelect';
import { MotorSelect } from '../components/MotorSelect';
import { Telemetry } from '../components/Telemetry';
import { StatusBadge, resolveVisualState } from '../components/StatusBadge';
import { DEFAULT_RUN_PARAMS, useSimulation } from '../useSimulation';
import { useSeriesRecorder } from '../useSeriesRecorder';
import { buildRecord } from '../buildRecord';
import { PulseChart } from '../components/PulseChart';

/** Estimate the nominal K at the commanded speed, using the user's gearRatio. */
const estimateNominalK = (
  pumpCode: string,
  pressureId: string,
  commandHz: number,
  densityKgM3: number,
  gearRatio: number,
): number | null => {
  if (!pumpCode || !pressureId || !(gearRatio > 0)) return null;
  const pump = getPump(pumpCode);
  const pressure = getPressureOption(pump, pressureId);
  const { pumpRpm, pulseHz } = computeDrive(commandHz, gearRatio);
  if (pumpRpm < pump.limits.rpmMin || pumpRpm > pump.limits.rpmMax) return null;
  const flow = lookupFlow(pump, pressure, pumpRpm);
  if (flow <= 0) return null;
  return pulsesPerKg(pulseHz, flow, densityKgM3);
};

export const Mode2Page = () => {
  const pumps = useMemo(() => listPumps(), []);
  const [pumpCode, setPumpCode] = useState('');
  const [pressureId, setPressureId] = useState('');
  const [motorIndex, setMotorIndex] = useState(0);
  const [gearRatio, setGearRatio] = useState<number | ''>('');
  const [commandHz, setCommandHz] = useState(60);
  const [targetMassKg, setTargetMassKg] = useState(2);
  const [densityKgM3, setDensityKgM3] = useState(1000);
  const [preact, setPreact] = useState(20);
  const [timeoutS, setTimeoutS] = useState(600);
  const [seed, setSeed] = useState(42);

  const pump = pumpCode ? getPump(pumpCode) : null;
  const motor = pump?.motorOptions[motorIndex] ?? null;
  const gearRatioValid = typeof gearRatio === 'number' && gearRatio > 0;
  const gearRatioNum = gearRatioValid ? (gearRatio as number) : 0;

  const { snapshot, history, status, errorMessage, send, reset } = useSimulation();
  const visual = resolveVisualState(status, snapshot, errorMessage);
  const { record } = useSeriesRecorder();

  const recordedRef = useRef(false);
  useEffect(() => {
    if (status === 'running' || status === 'paused' || status === 'idle') {
      recordedRef.current = false;
      return;
    }
    if ((status === 'done' || status === 'fault') && snapshot && pumpCode && motor && gearRatioValid && !recordedRef.current) {
      recordedRef.current = true;
      const pressure = getPressureOption(getPump(pumpCode), pressureId);
      void record('mode2', pumpCode, buildRecord(snapshot, pumpCode, {
        pressureId,
        pressureBar: pressure.bar,
        densityKgM3,
        motorRatedPowerKw: motor.motorKw,
        totalTimeS: snapshot.timeS,
        gearRatio: gearRatioNum,
        motorKw: motor.motorKw,
        gearboxModel: motor.gearboxModel,
        seed,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, snapshot]);

  const kNominal = estimateNominalK(pumpCode, pressureId, commandHz, densityKgM3, gearRatioNum);
  const preset = kNominal != null ? Math.round(targetMassKg * kNominal) : null;

  const onPumpChange = (code: string) => {
    setPumpCode(code);
    const p = code ? getPump(code) : null;
    setPressureId(p?.pressures[0]?.id ?? '');
    setMotorIndex(0);
  };

  const start = () => {
    if (!pump || !pressureId || !motor || !gearRatioValid || kNominal == null) return;
    const config: Mode2Config = {
      pumpCode,
      pressureId,
      commandHz,
      targetMassKg,
      densityKgM3,
      motorRatedPowerKw: motor.motorKw > 0 ? motor.motorKw : Infinity,
      gearRatio: gearRatioNum,
      motorKw: motor.motorKw,
      gearboxModel: motor.gearboxModel,
      kNominal,
      preact,
      timeoutS,
      seed,
      pressureJitterFrac: 0.02,
      densityJitterFrac: 0.005,
    };
    send({ type: 'start-mode2', config, params: { ...DEFAULT_RUN_PARAMS, pumpCode } });
  };

  const canStart = !!pump && !!pressureId && !!motor && gearRatioValid && kNominal != null;

  return (
    <section className="page">
      <div className="page-head">
        <h1>Modo 2 — Dosagem PLC</h1>
        <StatusBadge state={visual} />
      </div>

      <div className="layout">
        <form className="config" onSubmit={(e) => e.preventDefault()}>
          <label>
            Bomba
            <PumpSelect pumps={pumps} value={pumpCode} onChange={onPumpChange} />
          </label>
          <label>
            Pressão (curvas publicadas)
            <PressureSelect pump={pump} value={pressureId} onChange={setPressureId} />
          </label>
          <label>
            Motor / motoredutor
            <MotorSelect pump={pump} value={motorIndex} onChange={setMotorIndex} />
          </label>
          <label>
            Relação de transformação do motoredutor (a validar)
            <input type="number" value={gearRatio} min={0.1} step={0.1}
              placeholder="ex.: 4"
              onChange={(e) => setGearRatio(e.target.value === '' ? '' : Number(e.target.value))} />
          </label>
          <label>
            Velocidade (Hz)
            <input type="number" value={commandHz} min={0} max={60}
              onChange={(e) => setCommandHz(Number(e.target.value))} />
          </label>
          <label>
            Peso alvo (kg)
            <input type="number" value={targetMassKg} min={0} step={0.1}
              onChange={(e) => setTargetMassKg(Number(e.target.value))} />
          </label>
          <label>
            Densidade (kg/m³)
            <input type="number" value={densityKgM3} min={1}
              onChange={(e) => setDensityKgM3(Number(e.target.value))} />
          </label>
          <label>
            Pré-parada (pulsos)
            <input type="number" value={preact} min={0}
              onChange={(e) => setPreact(Number(e.target.value))} />
          </label>
          <label>
            Timeout (s)
            <input type="number" value={timeoutS} min={1}
              onChange={(e) => setTimeoutS(Number(e.target.value))} />
          </label>
          <label>
            Seed
            <input type="number" value={seed}
              onChange={(e) => setSeed(Number(e.target.value))} />
          </label>

          <div className="actions">
            <button type="button" onClick={start} disabled={!canStart}>Iniciar</button>
            <button type="button" onClick={reset}>Reset</button>
          </div>
          {!gearRatioValid && pump && (
            <p className="alert">Informe a relação de transformação do motoredutor para iniciar.</p>
          )}
          {gearRatioValid && kNominal == null && pump && (
            <p className="alert">Ponto fora da faixa publicada da curva para esta relação.</p>
          )}
          {errorMessage && <p className="alert">{errorMessage}</p>}
        </form>

        <div className="telemetry-panel">
          <div className="plc-panel">
            <h2>Painel PLC</h2>
            <ul>
              <li>Estado: {snapshot?.phase ?? 'IDLE'}</li>
              <li>K nominal: {kNominal != null ? kNominal.toFixed(2) : '—'} p/kg</li>
              <li>Preset: {snapshot?.preset ?? preset ?? '—'}</li>
              <li>HSC: {snapshot?.hsc ?? 0}</li>
              <li>Pré-parada: {preact} pulsos</li>
              <li>Tempo: {snapshot?.timeS != null ? snapshot.timeS.toFixed(1) : '—'} s</li>
              {snapshot?.faultReason && <li className="alert">Falha: {snapshot.faultReason}</li>}
            </ul>
          </div>
          <Telemetry snapshot={snapshot} />
          <div className="charts">
            <PulseChart history={history} />
          </div>
        </div>
      </div>
    </section>
  );
};
