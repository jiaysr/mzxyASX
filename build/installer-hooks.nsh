# Portable dirs keep hook.
#
# engine / data / profile 都放在 $INSTDIR 下（settings.ts 的「拷走即用」布局），
# 而 electron-builder 的更新流程会先静默跑旧版卸载器：它在 isUpdated 分支里
# 把 $INSTDIR 整个搬到临时目录再删掉（templates/nsis/uninstaller.nsh 的
# un.atomicRMDir），这三个目录会连带消失，用户就得重新下几百 MB 的引擎。
#
# 所以在 .onInit（customInit）里、旧卸载器还没动手时，把三个目录同盘改名到
# $INSTDIR\..\.mzxy-keep，装完在 customInstall 里改回来。同卷 Rename 是瞬时的，
# 不会因为引擎那上万个文件变慢；目录布局和便携性都不变。
#
# 任何一步失败都不阻塞安装：数据留在原处，退化成「更新后重新安装引擎」。
# 安装中途断电/失败留下的 .mzxy-keep*，由启动时的 restorePortableKeep() 兜底。

# 卸载器那一趟也会 include 这个文件，但不会插入上面两个宏；
# 不声明就不会有「变量未使用」告警（electron-builder 把告警当错误）
!ifndef BUILD_UNINSTALLER
Var keepRoot
Var keepMoved
!endif

!macro customInit
  StrCpy $keepMoved "0"
  ${If} ${isUpdated}
  ${AndIf} ${FileExists} "$INSTDIR\engine\*.*"
    # 上一轮残留就换个名字，绝不覆盖
    StrCpy $keepRoot "$INSTDIR\..\.mzxy-keep"
    StrCpy $0 "1"
    ${Do}
      ${IfNot} ${FileExists} "$keepRoot\*.*"
        ${ExitDo}
      ${EndIf}
      StrCpy $keepRoot "$INSTDIR\..\.mzxy-keep-$0"
      IntOp $0 $0 + 1
    ${LoopWhile} $0 < 100

    CreateDirectory "$keepRoot"
    DetailPrint "keep portable dirs at $keepRoot"
    # .onInit 开头 SetOutPath 过 $INSTDIR，把 CWD 挪出去再动目录
    SetOutPath $TEMP

    ${If} ${FileExists} "$INSTDIR\engine\*.*"
      ClearErrors
      Rename "$INSTDIR\engine" "$keepRoot\engine"
      ${If} ${Errors}
        DetailPrint "rename engine failed, skip keep"
      ${Else}
        StrCpy $keepMoved "1"
      ${EndIf}
    ${EndIf}

    ${If} ${FileExists} "$INSTDIR\data\*.*"
      ClearErrors
      Rename "$INSTDIR\data" "$keepRoot\data"
      ${If} ${Errors}
        DetailPrint "rename data failed, skip keep"
      ${Else}
        StrCpy $keepMoved "1"
      ${EndIf}
    ${EndIf}

    ${If} ${FileExists} "$INSTDIR\profile\*.*"
      ClearErrors
      Rename "$INSTDIR\profile" "$keepRoot\profile"
      ${If} ${Errors}
        DetailPrint "rename profile failed, skip keep"
      ${Else}
        StrCpy $keepMoved "1"
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstall
  ${If} $keepMoved == "1"
    ${If} ${FileExists} "$keepRoot\engine"
      Rename "$keepRoot\engine" "$INSTDIR\engine"
    ${EndIf}
    ${If} ${FileExists} "$keepRoot\data"
      Rename "$keepRoot\data" "$INSTDIR\data"
    ${EndIf}
    ${If} ${FileExists} "$keepRoot\profile"
      Rename "$keepRoot\profile" "$INSTDIR\profile"
    ${EndIf}
    # 只有空了才会删掉，非空说明还有东西没搬回，留给启动兜底
    RMDir "$keepRoot"
  ${EndIf}
!macroend
