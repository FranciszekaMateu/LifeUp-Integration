import { App, Plugin, PluginSettingTab, Setting, MarkdownView, Notice, requestUrl } from 'obsidian';

interface MyPluginSettings {
  setting1: string;
  setting2: string;
}

interface Task {
  id: number;
  nameExtended: string;
  status: number;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  setting1: '192.168.1.x',
  setting2: '13276'
}

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    console.log('Loading My Obsidian Plugin');

    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    console.log('Loaded settings:', this.settings);

    this.addSettingTab(new SampleSettingTab(this.app, this));

    this.addCommand({
      id: 'detect-life-up',
      name: 'Detect "life up" automatically',
      callback: () => this.detectLifeUp()
    });

    // Register event listener for markdown change
    this.registerEvent(this.app.workspace.on('editor-change', this.detectLifeUp.bind(this)));

    this.registerDomEvent(document, 'change', (event) => {
      const target = event.target as HTMLInputElement;
      if (target && target.dataset.taskId && target.type === 'checkbox') {
        const taskId = parseInt(target.dataset.taskId, 10);
        this.sendCompleteRequest(taskId, target);
      }
    });
  }

  onunload() {
    console.log('Unloading My Obsidian Plugin');
  }

  async saveSettings() {
    await this.saveData(this.settings);
    console.log('Settings saved:', this.settings);
  }

  async detectLifeUp() {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!mdView) {
      return;
    }

    const editor = mdView.editor;
    const text = editor.getValue();
    const lines = text.split('\n');

    lines.forEach(async (line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine === "'life up'") {
        await this.replaceLifeUp(editor, index);
      }
    });
  }

  async replaceLifeUp(editor: any, line: number) {
    const lineText = editor.getLine(line);

    if (lineText.trim() === "'life up'") {
      const { setting1: ip, setting2: port } = this.settings;
      const url = `http://${ip}:${port}/tasks`;

      console.log('Fetching tasks from URL:', url);

      try {
        const response = await requestUrl({ url });
        console.log('API response:', response);

        if (response.json.code === 200) {
          const tasks: Task[] = response.json.data;
          console.log('Tasks fetched:', tasks);

          const htmlContent = tasks.map((task: Task) => `
<div id="task-${task.id}">
  <input type="checkbox" data-task-id="${task.id}" class="complete-task-checkbox">
  <span>${task.nameExtended}</span>
</div>
`).join('\n');

          console.log('HTML content to insert:', htmlContent);

          editor.replaceRange(htmlContent, { line, ch: 0 }, { line, ch: lineText.length });
          new Notice('Tasks loaded successfully');
        } else {
          new Notice('Error fetching tasks: ' + response.json.message);
        }
      } catch (error) {
        console.log('Error fetching tasks:', error);
        new Notice('Error: ' + error.message);
      }
    } else {
      new Notice('Please write "life up" in the current line to fetch tasks');
    }
  }

  async sendCompleteRequest(taskId: number, checkboxElement?: HTMLInputElement) {
    const { setting1: ip, setting2: port } = this.settings;
    const url = `http://${ip}:${port}/api`;
    const body = { url: `lifeup://api/complete?id=${taskId}` };

    console.log('Sending POST request to URL:', url, 'with body:', body);

    try {
      const response = await requestUrl({
        url,
        method: 'POST',
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
      console.log('POST response:', response);
      new Notice(`Task ${taskId} completed successfully.`);

      // Update the task HTML
      if (checkboxElement) {
        this.markTaskAsCompleted(checkboxElement);
      }
    } catch (error) {
      console.log('Error sending POST request:', error);
      new Notice('Error completing task: ' + error.message);
    }
  }

  markTaskAsCompleted(checkboxElement: HTMLInputElement) {
    const taskElement = checkboxElement.parentElement;
    if (taskElement) {
      const span = taskElement.querySelector('span');
      if (span) {
        span.style.textDecoration = 'line-through'; // Apply the strikethrough style
      }
      checkboxElement.disabled = true; // Disable the checkbox
    }
  }
}

class SampleSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Settings to connect with Life Up API' });

    new Setting(containerEl)
      .setName('IP')
      .setDesc('Local IP of your phone')
      .addText(text => text
        .setPlaceholder('192.168.1.x')
        .setValue(this.plugin.settings.setting1)
        .onChange(async (value) => {
          this.plugin.settings.setting1 = value;
          console.log('Setting1 changed to:', value);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Port')
      .setDesc('PORT of your life up server, default is 13276')
      .addText(text => text
        .setPlaceholder('13276')
        .setValue(this.plugin.settings.setting2)
        .onChange(async (value) => {
          this.plugin.settings.setting2 = value;
          console.log('Setting2 changed to:', value);
          await this.plugin.saveSettings();
        }));
  }
}
