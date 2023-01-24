/* Copyright 2021, Milkdown by Mirone. */
import type { Ctx, MilkdownPlugin } from '@milkdown/core'
import { Editor, defaultValueCtx, editorViewOptionsCtx, rootCtx } from '@milkdown/core'
import { block, blockView } from '@milkdown/plugin-block'
import { clipboard } from '@milkdown/plugin-clipboard'
import { cursor } from '@milkdown/plugin-cursor'
import { diagram, diagramSchema } from '@milkdown/plugin-diagram'
import { emoji, emojiAttr } from '@milkdown/plugin-emoji'
import { history } from '@milkdown/plugin-history'
import { indent } from '@milkdown/plugin-indent'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { math, mathBlockSchema } from '@milkdown/plugin-math'
import { prism, prismConfig } from '@milkdown/plugin-prism'
import { slash } from '@milkdown/plugin-slash'
import { trailing } from '@milkdown/plugin-trailing'
import { upload } from '@milkdown/plugin-upload'
import { codeBlockSchema, commonmark, listItemSchema } from '@milkdown/preset-commonmark'
import { footnoteDefinitionSchema, footnoteReferenceSchema, gfm } from '@milkdown/preset-gfm'
import { useEditor } from '@milkdown/react'
import { nord } from '@milkdown/theme-nord'
import { $view } from '@milkdown/utils'
import { useNodeViewFactory, usePluginViewFactory, useWidgetViewFactory } from '@prosemirror-adapter/react'
import { useEffect, useMemo, useRef } from 'react'
import { refractor } from 'refractor/lib/common'
import { Block } from '../EditorComponent/Block'
import { CodeBlock } from '../EditorComponent/CodeBlock'
import { Diagram } from '../EditorComponent/Diagram'
import { FootnoteDef, FootnoteRef } from '../EditorComponent/Footnote'
import { ImageTooltip, imageTooltip } from '../EditorComponent/ImageTooltip'
import { linkPlugin } from '../EditorComponent/LinkWidget'
import { ListItem } from '../EditorComponent/ListItem'
import { MathBlock } from '../EditorComponent/MathBlock'
import { Slash } from '../EditorComponent/Slash'
import { TableTooltip, tableSelectorPlugin, tableTooltip, tableTooltipCtx } from '../EditorComponent/TableWidget'
import { useFeatureToggle } from './FeatureToggleProvider'

const useToggle = (label: string, state: boolean, get: () => Editor | undefined, plugins: MilkdownPlugin[]) => {
  const ref = useRef(state)
  useEffect(() => {
    const effect = async () => {
      const editor = get()
      if (!editor || ref.current === state)
        return

      if (!state) {
        await editor.remove(plugins)
        ref.current = false
      }
      else {
        editor.use(plugins)
        ref.current = true
      }

      await editor.create()
    }

    effect().catch((e) => {
      console.error('Error run toggle for: ', label)
      console.error(e)
    })
  }, [get, label, plugins, state])
}

export const usePlayground = (
  defaultValue: string,
  onChange: (markdown: string) => void,
) => {
  const pluginViewFactory = usePluginViewFactory()
  const nodeViewFactory = useNodeViewFactory()
  const widgetViewFactory = useWidgetViewFactory()
  const {
    enableGFM,
    enableMath,
    enableDiagram,
    enableBlockHandle,
    enableTwemoji,
  } = useFeatureToggle()

  const gfmPlugins: MilkdownPlugin[] = useMemo(() => {
    return [
      gfm,
      tableTooltip,
      tableTooltipCtx,
      () => async (ctx: Ctx) => {
        ctx.set(tableTooltip.key, {
          view: pluginViewFactory({
            component: TableTooltip,
          }),
        })
      },
      $view(footnoteDefinitionSchema.node, () => nodeViewFactory({ component: FootnoteDef })),
      $view(footnoteReferenceSchema.node, () => nodeViewFactory({ component: FootnoteRef })),
      tableSelectorPlugin(widgetViewFactory),
    ].flat()
  }, [nodeViewFactory, pluginViewFactory, widgetViewFactory])

  const mathPlugins: MilkdownPlugin[] = useMemo(() => {
    return [
      $view(mathBlockSchema.node, () => nodeViewFactory({
        component: MathBlock,
        stopEvent: () => true,
      })),
      math,
    ].flat()
  }, [nodeViewFactory])

  const diagramPlugins: MilkdownPlugin[] = useMemo(() => {
    return [
      diagram,
      $view(diagramSchema.node, () => nodeViewFactory({
        component: Diagram,
        stopEvent: () => true,
      })),
    ].flat()
  }, [nodeViewFactory])

  const blockPlugins: MilkdownPlugin[] = useMemo(() => {
    return [
      block,
      () => (ctx: Ctx) => {
        ctx.set(blockView.key, pluginViewFactory({
          component: Block,
        }))
      },
    ].flat()
  }, [pluginViewFactory])

  const twemojiPlugins: MilkdownPlugin[] = useMemo(() => {
    return [
      emoji,
      () => (ctx: Ctx) => {
        ctx.set(emojiAttr.key, () => ({
          span: {},
          img: {
            class: 'w-[1em] h-[1em] !m-0 inline-block mr-px align-text-top',
          },
        }))
      },
    ].flat()
  }, [])

  const editorInfo = useEditor((root) => {
    const editor = Editor
      .make()
      .config((ctx) => {
        ctx.set(editorViewOptionsCtx, ({
          attributes: {
            class: 'mx-auto p-1 box-border',
          },
        }))
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, defaultValue)
        ctx.update(editorViewOptionsCtx, prev => ({ ...prev }))
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onChange(markdown)
        })
        ctx.update(prismConfig.key, prev => ({
          ...prev,
          configureRefractor: () => refractor,
        }))
        ctx.set(imageTooltip.key, {
          view: pluginViewFactory({
            component: ImageTooltip,
          }),
        })
        ctx.set(slash.key, {
          view: pluginViewFactory({
            component: Slash,
          }),
        })
      })
      .config(nord)
      .use(commonmark)
      .use(linkPlugin(widgetViewFactory))
      .use(listener)
      .use(clipboard)
      .use(history)
      .use(cursor)
      .use(prism)
      .use(indent)
      .use(upload)
      .use(trailing)
      .use(imageTooltip)
      .use(slash)
      .use($view(listItemSchema.node, () => nodeViewFactory({ component: ListItem })))
      .use($view(codeBlockSchema.node, () => nodeViewFactory({ component: CodeBlock })))
      .use(gfmPlugins)
      .use(mathPlugins)
      .use(diagramPlugins)
      .use(blockPlugins)
      .use(twemojiPlugins)

    return editor
  }, [defaultValue, onChange])

  const { get } = editorInfo

  useToggle('GFM', enableGFM, get, gfmPlugins)
  useToggle('Math', enableMath, get, mathPlugins)
  useToggle('Diagram', enableDiagram, get, diagramPlugins)
  useToggle('BlockHandle', enableBlockHandle, get, blockPlugins)
  useToggle('Twemoji', enableTwemoji, get, twemojiPlugins)

  return editorInfo
}
