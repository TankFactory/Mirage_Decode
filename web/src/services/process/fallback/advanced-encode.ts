import type { PrismAdvancedEncodeConfig, PrismAdvancedEncodeService } from '../../../services/prism-advanced-encode';
import { prismAdvancedEncodeImpl } from '../advanced-encode-impl';
import type { FallbackProcessConstructor } from './common';

export function FallbackAdvancedEncodeProcess<TBase extends FallbackProcessConstructor>(Base: TBase) {
  return class extends Base implements PrismAdvancedEncodeService {
    prismAdvancedEncode(config: PrismAdvancedEncodeConfig): boolean {
      return prismAdvancedEncodeImpl(config);
    }
  };
}
