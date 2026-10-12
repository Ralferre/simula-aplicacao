/**
 * Motor + gearbox options per base pump model, transcribed from the Netzsch
 * NDB 106-06 monobloc tables:
 *   - page 10: série BY
 *   - page 14: série BO
 *   - page 22: série BH
 *
 * The three monobloc tables are identical in motor power / gearbox for the same
 * model, so a single map by base model suffices. Each entry pairs a motor power
 * (kW) with the Netzsch gear-motor code (NS xx).
 *
 * The numeric reduction ratio (gearRatio) is NOT published by Netzsch per NS
 * code and is entered by the user at runtime — never stored or guessed here.
 *
 * Bearing series (SY/SP, pages 17/19) use external belt/pulley drive, so they
 * get a single "externo" option (no NS gearbox).
 */

export interface MotorOption {
  motorKw: number;
  gearboxModel: string;
}

/** Base-model -> motor/gearbox options (monobloc series BY/BO/BH). */
export const MONOBLOC_MOTOR_TABLE: Record<string, MotorOption[]> = {
  NM015: [{ motorKw: 0.75, gearboxModel: 'NS 17' }],
  NM021: [{ motorKw: 0.75, gearboxModel: 'NS 17' }],
  NM031: [{ motorKw: 1.5, gearboxModel: 'NS 27' }],
  NM038: [
    { motorKw: 2.2, gearboxModel: 'NS 37' },
    { motorKw: 3.7, gearboxModel: 'NS 47' },
  ],
  NM045: [
    { motorKw: 2.2, gearboxModel: 'NS 57' },
    { motorKw: 3.7, gearboxModel: 'NS 57' },
    { motorKw: 5.5, gearboxModel: 'NS 57' },
  ],
  NM053: [
    { motorKw: 3.7, gearboxModel: 'NS 57' },
    { motorKw: 5.5, gearboxModel: 'NS 57' },
    { motorKw: 7.5, gearboxModel: 'NS 67' },
  ],
  NM063: [
    { motorKw: 5.5, gearboxModel: 'NS 67' },
    { motorKw: 7.5, gearboxModel: 'NS 67' },
    { motorKw: 9.2, gearboxModel: 'NS 77' },
    { motorKw: 11.0, gearboxModel: 'NS 77' },
  ],
  NM076: [
    { motorKw: 7.5, gearboxModel: 'NS 77' },
    { motorKw: 9.2, gearboxModel: 'NS 77' },
    { motorKw: 11.0, gearboxModel: 'NS 77' },
    { motorKw: 15.0, gearboxModel: 'NS 77' },
  ],
  NM090: [
    { motorKw: 11.0, gearboxModel: 'NS 77' },
    { motorKw: 15.0, gearboxModel: 'NS 87' },
    { motorKw: 18.5, gearboxModel: 'NS 87' },
    { motorKw: 22.0, gearboxModel: 'NS 87' },
  ],
  NM105: [
    { motorKw: 15.0, gearboxModel: 'NS 87' },
    { motorKw: 18.5, gearboxModel: 'NS 87' },
    { motorKw: 22.0, gearboxModel: 'NS 87' },
    { motorKw: 30.0, gearboxModel: 'NS 97' },
  ],
};

/** The single external-drive option for bearing series / unlisted models. */
export const EXTERNAL_DRIVE: MotorOption = {
  motorKw: 0,
  gearboxModel: 'externo',
};
