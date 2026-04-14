import { chaseProfile } from './chase';
import { bofaProfile } from './bofa';
import { capitalOneProfile } from './capitalOne';
import { amexProfile } from './amex';

export const BANK_PROFILES = {
  chase: chaseProfile,
  bofa: bofaProfile,
  capitalOne: capitalOneProfile,
  amex: amexProfile,
};

export { chaseProfile, bofaProfile, capitalOneProfile, amexProfile };
