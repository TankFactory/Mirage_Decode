import { Box, Typography, Link, Table, TableBody, TableCell, TableContainer, TableRow, Paper } from '@mui/material';
import { DayNightToggle } from '../components/day-night-toggle';
import { useThemeStore } from '../providers/theme';
import { MainContent } from '../pages/main-content';
import { useRef, useState } from 'react';
import { DraggableSidebar } from '../components/sidebar';
import { GlobalSnackbar } from '../components/snackbar';
import { DecodeList } from '../pages/decode-list';
import { useSidebarStore } from '../providers/sidebar';
import { version as appVersion } from '../../package.json';
import { changeLog } from '../constants/change-log';
import { zIndex } from '../constants/layout';
import { useDesktopModeInitializer, useSmallScreen } from '../providers/layout';
import { CommonDivider } from '../components/divider';

export function MainScreen() {
  useDesktopModeInitializer();

  const themeMode = useThemeStore((state) => state.mode);
  const toggleThemeMode = useThemeStore((state) => state.toggleTheme);
  const palette = useThemeStore((state) => state.palette);

  const dayNightToggleRef = useRef<HTMLElement>(null);

  const sidebarState = useSidebarStore();

  const smallScreen = useSmallScreen();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: palette.Background,
        minHeight: '100vh',
        gap: 2,
        paddingTop: 2,
        paddingBottom: 4,
        m: 0,
      }}
    >
      <Box
        sx={{
          position: 'fixed',
          left: 10,
          bottom: 10,
          zIndex: zIndex.action,
          backgroundColor: palette.SecondaryBackground,
          padding: 0.8,
          borderRadius: '50% / 100%',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
        }}
        ref={dayNightToggleRef}
      >
        <DayNightToggle value={themeMode} size={smallScreen ? 1 : 1.5} onChange={toggleThemeMode} />
      </Box>

      <DraggableSidebar
        hideFullscreenExcludes={[dayNightToggleRef]}
        minWidth={300}
        show={sidebarState.show}
        setShow={sidebarState.setShow}
      >
        <DecodeList />
      </DraggableSidebar>

      <GlobalSnackbar />

      <Typography variant="h4" sx={{ textAlign: 'center', marginTop: 4, fontWeight: 'bold' }}>
        光棱坦克工厂
      </Typography>
      <TopLinks />
      <MainContent />
      <VersionInfo />
      <CommonDivider width="min(100%, 600px)" />
      <BottomLinks />
      <CommonDivider width="min(100%, 600px)" />
      <ChangeHistory />
    </Box>
  );
}

function TopLinks() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        color: 'text.secondary',
      }}
    >
      <Typography variant="body2">
        <Link href="https://tieba.baidu.com/p/9093709508" target="_blank" rel="noopener">
          什么是光棱坦克
        </Link>
      </Typography>

      <Typography variant="body2">本网站仅做辅助, 并非此类坦克的唯一解!</Typography>

      <Typography variant="body2">
        请认准指定域名:&nbsp;
        <Link href="https://prism.uyanide.com" target="_blank" rel="noopener">
          https://prism.uyanide.com
        </Link>
      </Typography>

      <Box sx={{ margin: 0.5 }} />
      <Typography variant="body2">不习惯新版本? 老版本在这里:&nbsp;</Typography>
      <Link href="https://prism-old.uyanide.com" target="_blank" rel="noopener" variant="body2">
        https://prism-old.uyanide.com
      </Link>

      {/* <Box sx={{ margin: 0.5 }} />
      <Typography variant="body2">
        <Link href="https://example.com" target="_blank" rel="noopener">
          下载当前页面
        </Link>
        <Typography variant="caption">(可在任意现代浏览器中离线使用)</Typography>
      </Typography> */}
    </Box>
  );
}

function VersionInfo() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      <Typography variant="body1">
        当前版本: <strong>{appVersion}</strong>
      </Typography>
    </Box>
  );
}

function BottomLinks() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        color: 'text.secondary',
      }}
    >
      <Typography variant="body2">
        <Link href="https://github.com/TankFactory/Mirage_Decode?tab=readme-ov-file#qa" target="_blank" rel="noopener">
          常见问题 Q&A
        </Link>
      </Typography>

      <Box margin={0.5} />
      <Typography variant="body2">更多其他项目</Typography>
      <Typography variant="body2">
        <Link href="https://mtcloak.uyanide.com" target="_blank" rel="noopener">
          幻光火箭炮工厂 (暂定)
        </Link>
      </Typography>
      <Typography variant="body2">
        <Link href="https://mirage.uyanide.com" target="_blank" rel="noopener">
          全彩幻影坦克工厂
        </Link>
      </Typography>
      <Box margin={0.5} />
      <Typography variant="body2">
        <Link href="https://github.com/TankFactory/Mirage_Decode/issues/new" target="_blank" rel="noopener">
          Bug 或建议
        </Link>{' '}
        有问必答 <s>欢迎拷打</s>
      </Typography>
      <Typography variant="body2">
        <Link href="https://github.com/Uyanide" target="_blank" rel="noopener">
          Github - Uyanide (我)
        </Link>
      </Typography>
      <Typography variant="body2">
        <Link href="https://github.com/TankFactory/Mirage_Decode" target="_blank" rel="noopener">
          Github - Mirage_Decode (本项目仓库)
        </Link>
      </Typography>
    </Box>
  );
}

function ChangeHistory() {
  const [fold, setFold] = useState(true);
  const palette = useThemeStore((state) => state.palette);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        color: 'text.secondary',
      }}
    >
      <Link
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setFold(!fold);
        }}
        sx={{
          fontSize: 'small',
          textDecoration: 'none',
          cursor: 'pointer',
          '&:hover': {
            textDecoration: 'underline',
          },
        }}
      >
        {fold ? '显示主要更新记录' : '隐藏更新记录'}
      </Link>

      {!fold && (
        <Box
          sx={{
            width: '100%',
            maxWidth: 600,
          }}
        >
          <TableContainer
            component={Paper}
            sx={{
              backgroundColor: palette.SecondaryBackground,
              borderRadius: 4,
              padding: 2,
              transition: 'background-color 0.7s',
            }}
          >
            <Table size="small">
              <TableBody>
                {changeLog.map((item) => (
                  <TableRow key={item.version}>
                    <TableCell
                      sx={{
                        fontSize: 'small',
                        fontWeight: 'bold',
                        verticalAlign: 'top',
                      }}
                    >
                      {item.version}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: 'small',
                        lineHeight: 1.4,
                      }}
                    >
                      {item.changes.map((change, index) => (
                        <Typography
                          key={change}
                          variant="body2"
                          component="div"
                          sx={{ marginBottom: index < item.changes.length - 1 ? 0.5 : 0 }}
                        >
                          {change}
                          {index < item.changes.length - 1 && (
                            <>
                              ;<br />
                            </>
                          )}
                        </Typography>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}
