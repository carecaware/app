!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
Var SnkDlg
Var SnkChkDesk
Var SnkChkMenu
Var SnkDeskVal
Var SnkMenuVal
!endif

!ifndef BUILD_UNINSTALLER
Function SnkShortcutPage
  GetDlgItem $0 $HWNDPARENT 1037
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Atalhos"
  GetDlgItem $0 $HWNDPARENT 1038
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Escolha onde criar os atalhos do programa."
  nsDialogs::Create 1018
  Pop $SnkDlg
  ${If} $SnkDlg == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 12u "O programa será instalado na pasta (Arquivos de Programas):"
  Pop $0
  ${NSD_CreateLabel} 0 14u 100% 24u "$INSTDIR"
  Pop $0
  SendMessage $0 ${WM_SETFONT} 0 0
  ${NSD_CreateHLine} 0 44u 100% 1u ""
  Pop $0
  ${NSD_CreateLabel} 0 54u 100% 12u "Deseja criar atalhos?"
  Pop $0
  ${NSD_CreateCheckbox} 8u 72u 100% 12u "Criar atalho na Área de Trabalho (Desktop)"
  Pop $SnkChkDesk
  ${If} $SnkDeskVal != ${BST_UNCHECKED}
    ${NSD_Check} $SnkChkDesk
  ${EndIf}
  ${NSD_CreateCheckbox} 8u 90u 100% 12u "Criar acesso no Menu Iniciar"
  Pop $SnkChkMenu
  ${If} $SnkMenuVal != ${BST_UNCHECKED}
    ${NSD_Check} $SnkChkMenu
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function SnkShortcutPageLeave
  ${NSD_GetState} $SnkChkDesk $SnkDeskVal
  ${NSD_GetState} $SnkChkMenu $SnkMenuVal
FunctionEnd

!endif

!macro customPageAfterChangeDir
  !ifndef BUILD_UNINSTALLER
  Page custom SnkShortcutPage SnkShortcutPageLeave
  !endif
!macroend

!macro customInstall
  !ifndef BUILD_UNINSTALLER
  ; o instalador cria os dois atalhos; remove os que o usuário desmarcou
  ${If} $SnkDeskVal == ${BST_UNCHECKED}
    Delete "$newDesktopLink"
  ${EndIf}
  ${If} $SnkMenuVal == ${BST_UNCHECKED}
    Delete "$newStartMenuLink"
  ${EndIf}
  !endif
!macroend

!macro customInit
  !ifndef BUILD_UNINSTALLER
  StrCpy $SnkDeskVal ${BST_CHECKED}
  StrCpy $SnkMenuVal ${BST_CHECKED}
  !endif
!macroend
