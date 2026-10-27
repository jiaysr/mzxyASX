/**
 * 每个配置的日志滚动状态。
 *
 * 必须放在独立模块里：`<script setup>` 中的代码是跟着组件实例跑的，
 * 在里面写 `new Map()` 每次挂载都会是新的空表，切配置回来就丢了。
 */
export interface LogViewState {
  /** 上次的 scrollTop */
  offset: number
  /** 上次是否处于自动滚动（贴底）状态 */
  auto: boolean
}

export const logViewStates = new Map<string, LogViewState>()
