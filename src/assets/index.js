const CDN_URL = "https://jcdn-1251131545.file.myqcloud.com"
const FORMAT_TRANSFER_TABLE = {
    "woff": "woff",
    "woff2": "woff2",
    "ttf": "truetype",
    "svg": "svg",
    "svgz": "svg",
    "eot": "embedded-opentype",
    "otf": "opentype",
    "ttc": "collection",
    "otc": "collection",
}

function statFilename(filename) {
    const slices = filename.split(".")
    const extension = slices.pop()
    const base = slices.join(".")
    return {extension, base, filename}
}

function registerCompounts() {
    Vue.component("package-metadata", {
        template: document.querySelector("#vue-component-package-metadata").innerHTML,
        props: {meta: Object},
    })
    Vue.component("library-view", {
        template: document.querySelector("#vue-component-library-view").innerHTML,
        props: {package: Object, state: Object},
        data() {
            return {
                selected_version: ""
            }
        },
        methods: {
            preformattedContent(env) {
                if (this.selected_version === "") return ""
                let urls = []
                if (this.package.manifest_version === 1) {
                    urls = [this.fileUrl(this.package.name, this.selected_version, env)]
                }

                if (this.package.manifest_version === 2) {
                    this.package.version.filter(version => version.code === this.selected_version)[0].files.forEach(file => {
                        urls.push(this.fileUrl(this.package.name, this.selected_version, env, file))
                    })
                }
                return this.state.url ? urls.join("\n") : this.url2code(urls)
            },
            url2code(urls) {
                const lines = []
                urls.forEach(url => {
                    const extension = statFilename(url).extension
                    if (extension === "js") {
                        lines.push(`<script src="${url}"></script>`)
                    }
                    if (extension === "css") {
                        lines.push(`<link rel="stylesheet" href="${url}">`)
                    }
                })
                return lines.join("\n")
            },
            fileUrl(packageName, version, env, filename = null) {
                if (filename === null) {
                    // is manifest version 1
                    // only js, no css
                    const versionName = version.split(".")[0]
                    filename = `${packageName}${versionName}${(env === "dev") ? "" : ".min"}.js`
                    return `${CDN_URL}/${packageName}/${filename}`
                }
                if (this.package.manifest_version === 2) {
                    const stat = statFilename(filename)
                    if (env === "prod") {
                        filename = `${stat.base}.min.${stat.extension}`
                    }
                    return `${CDN_URL}/${packageName}/${version}/${filename}`
                }
            }
        },
        mounted() {
            this.selected_version = this.package.version[this.package.version.length - 1].code
        }
    })
    Vue.component("font-select-view", {
        template: document.querySelector("#vue-component-font-select-view").innerHTML,
        props: {package: Object, version: Object, state: Object},
        data() {
            return {
                selected_formats: [],
                selected_styles: [],
            }
        },
        methods: {
            checkboxId(obj) {
                return `package-font-checkbox-${this.package.name}-${this.version.code}-${btoa(JSON.stringify(obj))}`
            },
            setStylesSelection(mode) {
                if (mode === 'all') {
                    this.selected_styles = this.version.styles.map(style => style.name)
                }
                if (mode === 'none') {
                    this.selected_styles = []
                }
                if (mode === 'default') {
                    this.selected_styles = this.defaultStyleSelection
                }
            },
            fileUrl(style, format) {
                const base = `${CDN_URL}/${this.package.name}/${this.version.code}/${this.package.font_name}`
                return `${base}-${style}.${format}`
            },
            sortItems() {
                this.selected_formats.sort()
                this.selected_styles.sort((a, b) => {
                    const aStyle = this.version.styles.filter(style => style.name === a)[0]
                    const bStyle = this.version.styles.filter(style => style.name === b)[0]
                    const k = 25
                    const aIneex = aStyle.weight + k * (aStyle.italic ? 1 : -1)
                    const bIneex = bStyle.weight + k * (bStyle.italic ? 1 : -1)
                    return aIneex - bIneex
                })
            }
        },
        computed: {
            defaultStyleSelection() {
                return this.version.styles.filter(style => style.default).map(style => style.name)
            },
            cssCode() {
                if ((this.selected_formats.length < 1) || (this.selected_styles.length < 1)) { return "" }
                const blocks = []
                this.selected_styles.forEach(styleName => {
                    const style = this.version.styles.filter(s => s.name === styleName)[0]
                    let lines = '@font-face {\n'
                    lines += `    font-family: "${this.package.font_name}";\n`
                    lines += `    font-weight: ${style.weight};\n`
                    lines += `    font-style: ${style.italic ? 'italic' : 'normal'};\n`
                    const urls = []
                    this.selected_formats.forEach(format => {
                        const url = this.fileUrl(style.name, format)
                        const formatName = FORMAT_TRANSFER_TABLE[statFilename(url).extension]
                        urls.push(`,\n         url("${url}") format("${formatName}")`)
                    })
                    const firstUrl = urls[0]
                    urls[0] = '    src: ' + firstUrl.substring(2 + 4 + 5)
                    urls.push(urls.pop() + ";\n")
                    lines += urls.join("")
                    lines += '}'
                    blocks.push(lines)
                })
                return blocks.join("\n\n")
            },
            urlCode() {
                const urls = []
                this.selected_styles.forEach(style => {
                    this.selected_formats.forEach(format => {
                        urls.push(this.fileUrl(style, format))
                    })
                })
                return urls.join("\n")
            }
        },
        mounted() {
            this.selected_formats = this.version.formats
            this.selected_styles = this.defaultStyleSelection
            this.sortItems()
        }
    })
    Vue.component("font-view", {
        template: document.querySelector("#vue-component-font-view").innerHTML,
        props: {package: Object, state: Object},
        data() {
            return {
                versions: [],
                selected_version: "",
            }
        },
        async mounted() {
            const url = `/font-manifests/${this.package.name}.yaml`
            const res = await axios.get(`${url}?t=` + (new Date()).getTime())
            this.versions = jsyaml.load(res.data).versions
            this.selected_version = this.versions[this.versions.length - 1].code
        }
    })
}

function appStart() {
    registerCompounts()
    new Vue({
        el: "#app",
        data () {
            return {
                state: {
                    url: false,
                    env: "all",
                },
                packages: [],
            }
        },
        methods: {
            isFont(package) {
                return (package.manifest_version === 2) && (package.type === 'font')
            },
            isLibrary(package) {
                if (package.manifest_version === 1) { 
                    return true
                }
                return package.type === "library"
            }
        },
        async mounted () {
            this.packages = jsyaml.load((await axios.get("manifest.yaml")).data).packages
        }
    })
}
