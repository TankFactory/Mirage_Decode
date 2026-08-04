import type { PrismAdvancedEncodeConfig, PrismAdvancedEncodeService } from '../../../services/prism-advanced-encode';
import { prismAdvancedEncodeImpl } from '../advanced-encode-impl';
import type { WebGLProcessConstructor } from './helper';

export function WebGLAdvancedEncodeProcess<TBase extends WebGLProcessConstructor>(Base: TBase) {
  return class extends Base implements PrismAdvancedEncodeService {
    prismAdvancedEncode(config: PrismAdvancedEncodeConfig): boolean {
      return prismAdvancedEncodeImpl(config);
    }
  };
}
