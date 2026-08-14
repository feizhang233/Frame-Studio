import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SaveIcon from '@mui/icons-material/Save'
import LogoutIcon from '@mui/icons-material/Logout'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useState, type ChangeEvent, type MouseEvent, type RefObject } from 'react'
import type { AuthUser } from '../api/contracts'

interface TopToolbarProps {
  modelName: string
  isDirty: boolean
  analysisState: 'idle' | 'running' | 'success' | 'error'
  guidanceVisible: boolean
  currentUser: AuthUser | null
  authLoading: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onRename: (name: string) => void
  onNew: () => void
  onOpen: () => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  onRun: () => void
  onOpenGuidance: () => void
  onToggleGuidance: () => void
  onOpenAuth: () => void
  onLogout: () => void
}

function BrandMark() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 36,
        height: 36,
        borderRadius: 1.5,
        bgcolor: 'primary.dark',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        '& span': {
          position: 'absolute',
          display: 'block',
          bgcolor: 'primary.contrastText',
          borderRadius: 0.25,
          opacity: 0.85,
        },
        '& span:nth-of-type(1)': { width: 4, height: 20, left: 8, top: 8, bgcolor: '#b9c8ff' },
        '& span:nth-of-type(2)': { width: 17, height: 4, left: 8, top: 8, bgcolor: '#b9c8ff' },
        '& span:nth-of-type(3)': { width: 4, height: 20, right: 8, top: 8 },
      }}
    >
      <span />
      <span />
      <span />
    </Box>
  )
}

export function TopToolbar({
  modelName,
  isDirty,
  analysisState,
  guidanceVisible,
  currentUser,
  authLoading,
  fileInputRef,
  onRename,
  onNew,
  onOpen,
  onFileChange,
  onSave,
  onRun,
  onOpenGuidance,
  onToggleGuidance,
  onOpenAuth,
  onLogout,
}: TopToolbarProps) {
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null)

  return (
    <AppBar position="static" color="default" sx={{ zIndex: (t) => t.zIndex.appBar }}>
      <Toolbar variant="dense" sx={{ minHeight: 64, gap: { xs: 1, sm: 2 }, px: { xs: 1, sm: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
          <BrandMark />
          <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap lineHeight={1.2}>
              Frame Studio
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.08 }}>
              2D ANALYSIS
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={0.5}
          sx={{ display: { xs: 'none', md: 'flex' } }}
          aria-label="File actions"
        >
          <Tooltip title="New model">
            <Button size="small" startIcon={<NoteAddIcon />} onClick={onNew} color="inherit">
              New
            </Button>
          </Tooltip>
          <Tooltip title="Open JSON model">
            <Button size="small" startIcon={<FolderOpenIcon />} onClick={onOpen} color="inherit">
              Open
            </Button>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onFileChange}
            hidden
          />
          <Tooltip title={currentUser ? 'Save model (Ctrl/⌘ S)' : 'Sign in to save models'}>
            <Button size="small" startIcon={<SaveIcon />} onClick={onSave} color="inherit">
              Save
            </Button>
          </Tooltip>
        </Stack>

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 0.75,
            minWidth: 0,
            px: 1,
          }}
        >
          <AutoAwesomeIcon fontSize="small" color="action" sx={{ display: { xs: 'none', sm: 'block' } }} />
          <InputBase
            aria-label="Model name"
            value={modelName}
            onChange={(event) => onRename(event.target.value)}
            spellCheck={false}
            sx={{
              typography: 'body2',
              fontWeight: 600,
              maxWidth: 280,
              width: '100%',
              textAlign: 'center',
              '& input': { textAlign: 'center' },
            }}
          />
          {isDirty && (
            <Chip size="small" label="Unsaved" color="warning" variant="outlined" sx={{ height: 22 }} />
          )}
        </Box>

        <Stack direction="row" alignItems="center" spacing={1}>
          {analysisState === 'error' && (
            <Chip
              size="small"
              icon={<CloudOffIcon />}
              label="Offline"
              color="error"
              variant="outlined"
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            />
          )}
          {analysisState === 'success' && (
            <Chip
              size="small"
              label="Results ready"
              color="success"
              variant="outlined"
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            />
          )}

          <Tooltip title={guidanceVisible ? 'Hide contextual tips' : 'Show contextual tips'}>
            <IconButton
              size="small"
              color={guidanceVisible ? 'primary' : 'default'}
              onClick={onToggleGuidance}
              aria-pressed={guidanceVisible}
              aria-label="Toggle guidance tips"
            >
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open getting started guide">
            <Button
              size="small"
              color="inherit"
              onClick={onOpenGuidance}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Guide
            </Button>
          </Tooltip>

          {authLoading ? (
            <CircularProgress size={20} color="inherit" aria-label="Checking account" />
          ) : currentUser ? (
            <>
              <Button
                size="small"
                color="inherit"
                startIcon={<AccountCircleOutlinedIcon />}
                onClick={(event: MouseEvent<HTMLButtonElement>) => setAccountAnchor(event.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={Boolean(accountAnchor)}
                sx={{ maxWidth: 150, display: { xs: 'none', md: 'inline-flex' } }}
              >
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser.displayName}
                </Box>
              </Button>
              <IconButton
                size="small"
                color="inherit"
                onClick={(event) => setAccountAnchor(event.currentTarget)}
                aria-label="Open account menu"
                sx={{ display: { xs: 'inline-flex', md: 'none' } }}
              >
                <AccountCircleOutlinedIcon />
              </IconButton>
              <Menu
                anchorEl={accountAnchor}
                open={Boolean(accountAnchor)}
                onClose={() => setAccountAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <Box sx={{ px: 2, py: 1, minWidth: 220 }}>
                  <Typography variant="subtitle2">{currentUser.displayName}</Typography>
                  <Typography variant="caption" color="text.secondary">{currentUser.email}</Typography>
                </Box>
                <MenuItem onClick={() => { setAccountAnchor(null); onLogout() }}>
                  <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                  Sign out
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Chip
                size="small"
                label="Guest"
                variant="outlined"
                sx={{ display: { xs: 'none', lg: 'inline-flex' }, height: 26 }}
              />
              <Button
                size="small"
                color="inherit"
                startIcon={<AccountCircleOutlinedIcon />}
                onClick={onOpenAuth}
              >
                Sign in
              </Button>
            </Stack>
          )}

          <Button
            variant="contained"
            color="primary"
            onClick={onRun}
            disabled={analysisState === 'running'}
            startIcon={
              analysisState === 'running'
                ? <CircularProgress size={16} color="inherit" />
                : <PlayArrowIcon />
            }
            sx={{ minWidth: { xs: 40, sm: 140 }, px: { xs: 1, sm: 2 } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              {analysisState === 'running' ? 'Running…' : 'Run Analysis'}
            </Box>
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  )
}
