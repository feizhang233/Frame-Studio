import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SaveIcon from '@mui/icons-material/Save'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { ChangeEvent, RefObject } from 'react'

interface TopToolbarProps {
  modelName: string
  isDirty: boolean
  analysisState: 'idle' | 'running' | 'success' | 'error'
  guidanceVisible: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onRename: (name: string) => void
  onNew: () => void
  onOpen: () => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  onRun: () => void
  onOpenGuidance: () => void
  onToggleGuidance: () => void
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
  fileInputRef,
  onRename,
  onNew,
  onOpen,
  onFileChange,
  onSave,
  onRun,
  onOpenGuidance,
  onToggleGuidance,
}: TopToolbarProps) {
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
          <Tooltip title="Save model (Ctrl/⌘ S)">
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
