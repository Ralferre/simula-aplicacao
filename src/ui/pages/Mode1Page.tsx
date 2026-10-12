import { useMemo, useState, useEffect, useRef } from 'react';
import { listPumps, getPump } from '../../data/catalog';
import { getPressureOption } from '../../domain/catalog/pressure';
import type { Mode1Config } from '../../domain/simulation/mode1';
import { PumpSelect } from '../components/PumpSelect';
import { PressureSelect } from '../components/PressureSelect';
import { MotorSelect } from '../components/MotorSelect';
import { Telemetry } from '../components/Telemetry';
import { StatusBadge, resolveVisualState } from '../components/StatusBadge';
import { DEFAULT_RUN_PARAMS, useSimulation } from '../useSimulation';
import { useSeriesRecorder } from '../useSeriesRecorder';
import { buildRecord } from '../buildRecord';
import { CurveChart } from '../components/CurveChart';
import { PulseChart } from '../components/PulseChart';

export const Mode1Page = () => {
  const pumps = useMemo(() => listPumps(), []);
  const [pumpCode, setPumpCode] = useState('');
  const [pressureId, setPressureId] = useState('');
  const [motorIndex, setMotorIndex] = useState(0);
  const [gearRatio, setGearRatio] = useState<number | ''>('');
  const [commandHz, setCommandHz] = useState(60);
  const [targetMassKg, setTargetMassKg] = useState(50);
  const [densityKgM3, setDensityKgM3] = useState(1000);
  const [totalTimeS, setTotalTimeS] = useState(10);

  const pump = pumpCode ? getPump(pumpCode) : null;
  const motor = pump?.motorOptions[motorIndex] ?? null;
  // Rated power: the selected motor kW; 0 (externo) means no explicit limit.
  const motorRatedPowerKw = motor && motor.motorKw > 0 ? motor.motorKw : Infinity;
  const gearRatioValid = typeof gearRatio === 'number' && gearRatio > 0;

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
      void record('mode1', pumpCode, buildRecord(snapshot, pumpCode, {
        pressureId,
        pressureBar: pressure.bar,
        densityKgM3,
        motorRatedPowerKw: motor.motorKw,
        totalTimeS,
        gearRatio: gearRatio as number,
        motorKw: motor.motorKw,
        gearboxModel: motor.gearboxModel,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, snapshot]);

  const onPumpChange = (code: string) => {
    setPumpCode(code);
    const p = code ? getPump(code) : null;
    setPressureId(p?.pressures[0]?.id ?? '');
    setMotorIndex(0);
  };

  const start = () => {
    if (!pump || !pressureId || !motor || !gearRatioValid) return;
    const config: Mode1Config = {
      pumpCode,
      pressureId,
      commandHz,
      targetMassKg,
      densityKgM3,
      motorRatedPowerKw,
      gearRatio: gearRatio as number,
      motorKw: motor.motorKw,
      gearboxModel: motor.gearboxModel,
      totalTimeS,
    };
    send({ type: 'start-mode1', config, params: { ...DEFAULT_RUN_PARAMS, pumpCode } });
  };

  return (
    <section className="page">
      <div className="page-head">
        <h1>Modo 1 — Ciclo por tempo</h1>
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
            Velocidade comandada (Hz)
            <input type="number" value={commandHz} min={0} max={60}
              onChange={(e) => setCommandHz(Number(e.target.value))} />
          </label>
          <label>
            Peso alvo (kg)
            <input type="number" value={targetMassKg} min={0}
              onChange={(e) => setTargetMassKg(Number(e.target.value))} />
          </label>
          <label>
            Densidade (kg/m³)
            <input type="number" value={densityKgM3} min={1}
              onChange={(e) => setDensityKgM3(Number(e.target.value))} />
          </label>
          <label>
            Tempo total (s)
            <input type="number" value={totalTimeS} min={1}
              onChange={(e) => setTotalTimeS(Number(e.target.value))} />
          </label>

          <div className="actions">
            <button type="button" onClick={start}
              disabled={!pump || !pressureId || !motor || !gearRatioValid}>
              Iniciar
            </button>
            <button type="button" onClick={() => send({ type: 'pause' })}
              disabled={status !== 'running'}>Pausar</button>
            <button type="button" onClick={() => send({ type: 'resume' })}
              disabled={status !== 'paused'}>Retomar</button>
            <button type="button" onClick={reset}>Reiniciar</button>
          </div>
          {!gearRatioValid && pump && (
            <p className="alert">Informe a relação de transformação do motoredutor para iniciar.</p>
          )}
          {errorMessage && <p className="alert">{errorMessage}</p>}
          {snapshot?.alerts.map((a) => <p className="alert" key={a}>{a}</p>)}
        </form>

        <div className="telemetry-panel">
          <Telemetry snapshot={snapshot} />
          <div className="charts">
            <CurveChart pump={pump} pressureId={pressureId} snapshot={snapshot} />
            <PulseChart history={history} />
          </div>
        </div>
      </div>
    </section>
  );
};
