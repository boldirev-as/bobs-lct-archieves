
import AudioAssetPlayer from '../../helpers/audioAssetPlayer';

export type CallAudioAssetName = 'call_busy.mp3' | 'call_connect.mp3' | 'call_end.mp3' | 'call_incoming.mp3' | 'call_outgoing.mp3' | 'voip_failed.mp3' | 'voip_connecting.mp3';

let audioAsset: AudioAssetPlayer<CallAudioAssetName>;
export default function getCallAudioAsset() {
  return audioAsset ??= new AudioAssetPlayer([
    'call_busy.mp3',
    'call_connect.mp3',
    'call_end.mp3',
    'call_incoming.mp3',
    'call_outgoing.mp3',
    'voip_failed.mp3'
  ]);
}
