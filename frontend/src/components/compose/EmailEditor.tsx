import React, { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Link, List, ListOrdered } from 'lucide-react';

interface EmailEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const EmailEditor: React.FC<EmailEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your email message here...',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync initial or reset value
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      if (value === '') {
        editorRef.current.innerHTML = '';
      } else if (!editorRef.current.innerHTML) {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value]);

  const execCommand = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleLink = () => {
    const url = prompt('Enter link URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden bg-white focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-colors">
      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-gray-50/80 border-b border-gray-200 text-gray-600">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors"
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors"
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors"
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>

        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors"
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors"
          title="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>

        <button
          type="button"
          onClick={handleLink}
          className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transition-colors"
          title="Insert Link"
        >
          <Link className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Editable Canvas */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-4 min-h-[220px] max-h-[400px] overflow-y-auto text-xs text-gray-900 focus:outline-none prose prose-sm max-w-none"
        data-placeholder={placeholder}
      />
    </div>
  );
};
