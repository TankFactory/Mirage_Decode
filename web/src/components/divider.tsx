import { Box } from '@mui/material';
import { useThemeStore } from '../providers/theme';

export function CommonDivider({ width }: { width?: string | number }) {
  const palette = useThemeStore((state) => state.palette);

  return (
    <Box
      sx={{
        width: width ?? '100%',
        height: '1px',
        background: `linear-gradient(to right, transparent, ${palette.ElementBackground},${palette.ElementBackground}, transparent)`,
        my: 0.5,
      }}
    />
  );
}
