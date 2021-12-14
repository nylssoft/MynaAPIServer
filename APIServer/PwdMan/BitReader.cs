/*
    Myna API Server
    Copyright (C) 2021 Niels Stockfleth

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
using System.IO;

namespace APIServer.PwdMan
{
    public class BitReader
    {
        private readonly Stream stream;
        private int nextByte;
        private int bitPos;

        public BitReader(Stream dataStream)
        {
            stream = dataStream;
            nextByte = stream.ReadByte();
            bitPos = 7;
        }

        public int NextBit()
        {
            int ret = -1;
            if (nextByte >= 0)
            {
                var mask = 1 << bitPos;
                ret = ((nextByte & mask) == mask) ? 1 : 0;
                bitPos -= 1;
                if (bitPos < 0)
                {
                    bitPos = 7;
                    nextByte = stream.ReadByte();
                }
            }
            return ret;
        }

        public int NextBits(int cnt)
        {
            var max = cnt;
            var ret = 0;
            while (cnt > 0)
            {
                var b = NextBit();
                if (b == -1)
                {         
                    if (cnt == max)
                    {
                        ret = -1;
                    }
                    break;
                }
                if (b == 1)
                {
                    ret += 1 << (cnt - 1); 
                }
                cnt--;
            }
            return ret;
        }
    }
}
